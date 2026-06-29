import re
import math
from collections import defaultdict

class Extractor:
    def __init__(self):
        pass
        
    def bbox_distance(self, b1, b2):
        # b1, b2: [xmin, ymin, xmax, ymax]
        x_dist = max(0, max(b1[0], b2[0]) - min(b1[2], b2[2]))
        y_dist = max(0, max(b1[1], b2[1]) - min(b1[3], b2[3]))
        return math.sqrt(x_dist**2 + y_dist**2)

    def is_inside(self, pt_box, roi_box):
        px1, py1, px2, py2 = pt_box
        rx, ry, rw, rh = roi_box
        rx2, ry2 = rx + rw, ry + rh
        
        # Center of token
        cx = (px1 + px2) / 2
        cy = (py1 + py2) / 2
        
        return rx <= cx <= rx2 and ry <= cy <= ry2

    def extract_features(self, ocr_data, opencv_features=None, rois=None):
        features = {
            "title_block": {},
            "bom_table": [],
            "dimensions": [],
            "materials": [],
            "surface_finish": [],
            "notes": [],
            "rejected_candidates": []
        }
        
        if not rois:
            rois = []
            
        confidence_summary = {}
        full_text_list = []
        tb_keywords = ["REV", "DWG NO", "PART NO", "QTY", "SCALE", "MATERIAL", "TITLE", "DRAWN BY", "DATE", "WEIGHT"]
        materials_pattern = r'\b(MS|SS304|SS316|EN8|AL|CI|ALUMINIUM|STEEL)\b'
        surface_finish_pattern = r'(?:Ra|Rz)\s*(\d+(?:\.\d+)?)'

        if not opencv_features:
            opencv_features = {"circles": [], "lines": [], "contours": []}

        # Spatial grouping
        bom_tokens = []
        notes_tokens = []
        tb_tokens = []
        other_tokens = []
        candidates = []

        for item in ocr_data:
            text = item.get("text", "").strip()
            conf = item.get("confidence", 0.0)
            bbox = item.get("bbox", [0, 0, 0, 0])
            full_text_list.append(text)
            
            clean_text = text
            clean_text = re.sub(r'M\s+(\d+)', r'M\1', clean_text, flags=re.IGNORECASE)
            clean_text = re.sub(r'X\s+(\d+)', r'X\1', clean_text, flags=re.IGNORECASE)
            clean_text = re.sub(r'(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)', r'\1 - \2', clean_text)

            def remove_leading_zero(m):
                val = m.group(1)
                if val.startswith("0") and not val.startswith("0.") and len(val) > 1:
                    stripped = val.lstrip("0")
                    return stripped if stripped else "0"
                return val
                
            clean_text = re.sub(r'\b(0\d+(?:\.\d+)?)\b', remove_leading_zero, clean_text)
            text_upper = clean_text.upper()

            item["clean_text"] = clean_text
            item["text_upper"] = text_upper
            
            # Map token to ROI
            matched_roi = None
            for roi in rois:
                if self.is_inside(bbox, roi['box']):
                    matched_roi = roi['type']
                    break
                    
            if matched_roi == 'bom_table':
                bom_tokens.append(item)
                continue
            elif matched_roi == 'dimension_area':
                # Treat dimension area notes specifically
                notes_tokens.append(item)
            elif matched_roi == 'title_block':
                tb_tokens.append(item)
            
            # Legacy general extraction (runs for all non-BOM tokens)
            mat_match = re.search(materials_pattern, text_upper)
            if mat_match:
                features["materials"].append({"value": mat_match.group(0), "confidence": conf})
                
            sf_match = re.search(surface_finish_pattern, clean_text)
            if sf_match:
                features["surface_finish"].append({"value": sf_match.group(0), "confidence": conf})
                
            if "NOTE" in text_upper:
                features["notes"].append(clean_text)
            
            if re.search(r'\d', clean_text):
                candidates.append(item)
            else:
                other_tokens.append(item)

        # -----------------------------
        # Parse BOM Table
        # -----------------------------
        if not bom_tokens:
            # Fallback: look for BOM headers like "ITEM", "QTY", "DESCRIPTION"
            for t in other_tokens + candidates + tb_tokens:
                if re.search(r'\b(ITEM|DESCRIPTION|QTY\.)\b', t['text_upper']):
                    # Assume BOM is a table in the right half of the page, above or around this token
                    bx1, by1, bx2, by2 = t['bbox']
                    # Grab everything in the same general vertical column (right side)
                    for pt in ocr_data:
                        if pt['bbox'][0] > bx1 - 200: # on the right side
                            bom_tokens.append(pt)
                    break
                    
        if bom_tokens:
            # Group by Y coordinate (rows)
            bom_tokens.sort(key=lambda t: t['bbox'][1])
            rows = []
            current_row = []
            last_y = -1
            
            for token in bom_tokens:
                cy = (token['bbox'][1] + token['bbox'][3]) / 2
                if last_y == -1 or abs(cy - last_y) < 25: # 25px row threshold (increased for large images)
                    current_row.append(token)
                    if last_y == -1: last_y = cy
                    else: last_y = (last_y + cy) / 2
                else:
                    rows.append(current_row)
                    current_row = [token]
                    last_y = cy
            if current_row:
                rows.append(current_row)
                
            for row in rows:
                row.sort(key=lambda t: t['bbox'][0]) # Sort left-to-right
                row_text = [t['text'] for t in row]
                # Try to filter out noise, only keep rows with at least 2 items
                if len(row_text) > 1:
                    features["bom_table"].append(row_text)

        # -----------------------------
        # Parse Title Block Spatial Pairs
        # -----------------------------
        # Fallback if ROI detector completely failed
        if not tb_tokens:
            tb_tokens = ocr_data
            
        if tb_tokens:
            for tb_t in tb_tokens:
                tu = tb_t['text_upper']
                for kw in tb_keywords:
                    if kw in tu:
                        # Find nearest token to the right OR directly below
                        right_tokens = [t for t in tb_tokens if t['bbox'][0] >= tb_t['bbox'][0] - 50 and t['bbox'][1] >= tb_t['bbox'][1] - 20 and t != tb_t]
                        
                        val_candidate = tu.replace(kw, '').strip(" :.-")
                        has_digits = any(char.isdigit() for char in val_candidate)
                        
                        # Use nearest right token first, UNLESS the current token explicitly contains a value (e.g. digits)
                        if right_tokens and not has_digits:
                            # sort by Euclidean distance
                            right_tokens.sort(key=lambda t: self.bbox_distance(tb_t['bbox'], t['bbox']))
                            features["title_block"][kw] = right_tokens[0]['clean_text']
                        elif val_candidate:
                            features["title_block"][kw] = tb_t['clean_text'].replace(kw, '', 1).replace(kw.lower(), '', 1).strip(" :.-")
                        elif right_tokens:
                            # Fallback if val_candidate is empty but there are right tokens
                            right_tokens.sort(key=lambda t: self.bbox_distance(tb_t['bbox'], t['bbox']))
                            features["title_block"][kw] = right_tokens[0]['clean_text']
                        else:
                            # Just use itself if no right token
                            features["title_block"][kw] = tb_t['clean_text']
                        break

        # -----------------------------
        # Notes Area Parsing
        # -----------------------------
        if notes_tokens:
            notes_tokens.sort(key=lambda t: (t['bbox'][1] // 20, t['bbox'][0]))
            note_str = " ".join([t['clean_text'] for t in notes_tokens])
            if note_str.strip():
                features["notes"].append(note_str.strip())


        # -----------------------------
        # Dimensions Parsing (Legacy Logic)
        # -----------------------------
        for cand in candidates:
            raw_text = cand["text"]
            clean_text = cand["clean_text"]
            text_upper = cand["text_upper"]
            bbox = cand["bbox"]
            conf = cand["confidence"]

            reject_reason = None
            if re.match(r'^[1-6A-D]$', text_upper):
                reject_reason = "border_grid_label"
            elif "FOR" in text_upper and "-" in text_upper:
                reject_reason = "title_block_tolerance_table"
            elif "TOL" in text_upper:
                reject_reason = "title_block_tolerance_table"
            elif re.match(r'^REV\s*\d+', text_upper) or "SHEET" in text_upper:
                reject_reason = "not_dimension"
            elif re.search(r'\b(20MN|16MN|CR5|SAE\s*52100|CRCA|EN8|SS304|HRC)\b', text_upper):
                reject_reason = "material_grade"

            if reject_reason:
                features["rejected_candidates"].append({
                    "raw_text": raw_text,
                    "normalized_text": clean_text,
                    "reason": reject_reason,
                    "bbox": bbox
                })
                continue

            source_format = "nominal"
            nom, min_val, max_val, pitch = None, None, None, None
            
            pm_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:±|\\\+-|\+-)\s*(\d+(?:\.\d+)?)', clean_text)
            tol_match = re.search(r'(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)\s*/\s*-\s*(\d+(?:\.\d+)?)', clean_text)
            minus_match = re.search(r'(\d+(?:\.\d+)?)\s+(-\s*\d+(?:\.\d+)?)', clean_text)
            plus_match = re.search(r'(\d+(?:\.\d+)?)\s+(\+\s*\d+(?:\.\d+)?)', clean_text)
            range_match = re.search(r'(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)', clean_text)
            thread_match = re.search(r'(M\d+(?:\.\d+)?)(?:[xX](\d+(?:\.\d+)?))?', text_upper)
            space_tol_match = re.search(r'(\d+(?:\.\d+)?)\s+(0\.\d+)', clean_text)

            if thread_match:
                source_format = "thread_callout"
                nom = float(re.search(r'\d+(?:\.\d+)?', thread_match.group(1)).group(0))
                if thread_match.group(2):
                    pitch = float(thread_match.group(2))
            elif range_match and not "M" in text_upper:
                source_format = "range"
                v1, v2 = float(range_match.group(1)), float(range_match.group(2))
                min_val = min(v1, v2)
                max_val = max(v1, v2)
                nom = (min_val + max_val) / 2
            elif pm_match:
                source_format = "plus_minus_tolerance"
                nom = float(pm_match.group(1))
                tol_v = float(pm_match.group(2))
                min_val = nom - tol_v
                max_val = nom + tol_v
            elif tol_match:
                source_format = "bilateral_tolerance"
                nom = float(tol_match.group(1))
                max_val = nom + float(tol_match.group(2))
                min_val = nom - float(tol_match.group(3))
            elif minus_match:
                source_format = "unilateral_tolerance"
                nom = float(minus_match.group(1))
                min_val = nom + float(minus_match.group(2).replace(' ',''))
                max_val = nom
            elif plus_match:
                source_format = "unilateral_tolerance"
                nom = float(plus_match.group(1))
                min_val = nom
                max_val = nom + float(plus_match.group(2).replace(' ',''))
            elif space_tol_match:
                source_format = "plus_minus_tolerance"
                nom = float(space_tol_match.group(1))
                tol_v = float(space_tol_match.group(2))
                min_val = nom - tol_v
                max_val = nom + tol_v
            else:
                m = re.search(r'\d+(?:\.\d+)?', clean_text)
                if m:
                    nom = float(m.group(0))

            if nom is None:
                features["rejected_candidates"].append({
                    "raw_text": raw_text,
                    "normalized_text": clean_text,
                    "reason": "not_dimension",
                    "bbox": bbox
                })
                continue

            nearby_tokens = []
            nearby_tokens_used = []
            for ot in other_tokens + candidates:
                if ot == cand: continue
                if self.bbox_distance(bbox, ot["bbox"]) < 150:
                    nearby_tokens.append(ot)

            m_type = "unknown_dimension"
            mapping_reason = ""
            evidence_used = []
            
            if re.search(r'(?:Ø|⌀|DIA|DIAMETER)', text_upper):
                m_type = "diameter"
                mapping_reason = "Direct keyword: diameter"
                evidence_used.append("ocr_text")
            elif re.search(r'(?:OD|OUTER DIA|OUTSIDE DIA)', text_upper):
                m_type = "outer_diameter"
                mapping_reason = "Direct keyword: outer diameter"
                evidence_used.append("ocr_text")
            elif re.search(r'(?:ID|INNER DIA|INSIDE DIA|BORE)', text_upper):
                m_type = "inner_diameter"
                mapping_reason = "Direct keyword: inner diameter"
                evidence_used.append("ocr_text")
            elif re.search(r'(?:HOLE|DRILL|THRU|THROUGH)', text_upper):
                m_type = "hole_diameter"
                mapping_reason = "Direct keyword: hole"
                evidence_used.append("ocr_text")
            elif source_format == "thread_callout":
                m_type = "thread"
                mapping_reason = "Direct pattern: thread M-prefix"
                evidence_used.append("ocr_text")
            elif re.search(r'(?:^|\s)(?:R\s*\d+|RAD\s*\d+|RADIUS\s*\d+)', text_upper):
                m_type = "radius"
                mapping_reason = "Direct keyword: radius pattern"
                evidence_used.append("ocr_text")
            elif re.search(r'(?:C\d+|CHAMFER|45°)', text_upper):
                m_type = "chamfer"
                mapping_reason = "Direct keyword: chamfer"
                evidence_used.append("ocr_text")
            elif re.search(r'(?:DEPTH|DEEP)', text_upper):
                m_type = "depth"
                mapping_reason = "Direct keyword: depth"
                evidence_used.append("ocr_text")

            if m_type == "unknown_dimension":
                for nt in nearby_tokens:
                    ntu = nt["text_upper"]
                    if re.search(r'(?:OD|OUTER|OUTSIDE)', ntu):
                        m_type = "outer_diameter"
                        mapping_reason = f"Nearby token '{ntu}' suggests outer diameter"
                        evidence_used.append("nearby_token")
                        nearby_tokens_used.append(ntu)
                        break
                    elif re.search(r'(?:ID|INNER|BORE)', ntu):
                        m_type = "inner_diameter"
                        mapping_reason = f"Nearby token '{ntu}' suggests inner diameter"
                        evidence_used.append("nearby_token")
                        nearby_tokens_used.append(ntu)
                        break
                    elif re.search(r'(?:DIA|Ø|⌀)', ntu):
                        m_type = "diameter"
                        mapping_reason = f"Nearby token '{ntu}' suggests diameter"
                        evidence_used.append("nearby_token")
                        nearby_tokens_used.append(ntu)
                        break
                    elif re.search(r'(?:HOLE|DRILL|THRU)', ntu):
                        m_type = "hole_diameter"
                        mapping_reason = f"Nearby token '{ntu}' suggests hole"
                        evidence_used.append("nearby_token")
                        nearby_tokens_used.append(ntu)
                        break
                    elif re.search(r'(?:THK|THICK|THICKNESS)', ntu):
                        m_type = "thickness"
                        mapping_reason = f"Nearby token '{ntu}' suggests thickness"
                        evidence_used.append("nearby_token")
                        nearby_tokens_used.append(ntu)
                        break
                    elif re.search(r'(?:LENGTH|LONG)', ntu):
                        m_type = "length"
                        mapping_reason = f"Nearby token '{ntu}' suggests length"
                        evidence_used.append("nearby_token")
                        nearby_tokens_used.append(ntu)
                        break
                    elif re.search(r'(?:WIDTH|WIDE)', ntu):
                        m_type = "width"
                        mapping_reason = f"Nearby token '{ntu}' suggests width"
                        evidence_used.append("nearby_token")
                        nearby_tokens_used.append(ntu)
                        break

            if m_type == "unknown_dimension":
                cand_center = ((bbox[0]+bbox[2])/2, (bbox[1]+bbox[3])/2)
                for circle in opencv_features.get("circles", []):
                    cx, cy, r = circle["x"], circle["y"], circle["r"]
                    dist_to_center = math.sqrt((cand_center[0]-cx)**2 + (cand_center[1]-cy)**2)
                    dist_to_edge = abs(dist_to_center - r)
                    if dist_to_edge < 30:
                        if r > 50:
                            m_type = "outer_diameter"
                            mapping_reason = "Candidate is near outer circle boundary"
                        else:
                            m_type = "hole_diameter"
                            mapping_reason = "Candidate is near small circle boundary"
                        evidence_used.append("geometry")
                        break
            
            final_conf = conf
            if "ocr_text" in evidence_used: final_conf += 0.35
            if "nearby_token" in evidence_used: final_conf += 0.25
            if "geometry" in evidence_used: final_conf += 0.25

            requires_engineer_review = False
            if m_type == "unknown_dimension":
                requires_engineer_review = True
                mapping_reason = "Tolerance/Number parsed but no symbol/context found"
            elif len(evidence_used) == 0:
                final_conf = min(0.65, final_conf)
                requires_engineer_review = True
                mapping_reason = "Inferred without strong evidence, requires review"

            final_conf = min(1.0, final_conf)

            dim_obj = {
                "raw_text": raw_text,
                "normalized_text": clean_text,
                "source_format": source_format,
                "manufacturing_type": m_type,
                "nominal": nom,
                "unit": "mm",
                "min": min_val,
                "max": max_val,
                "confidence": final_conf,
                "bbox": bbox,
                "mapping_reason": mapping_reason,
                "evidence_used": evidence_used,
                "nearby_tokens_used": nearby_tokens_used,
                "requires_engineer_review": requires_engineer_review
            }
            if pitch is not None:
                dim_obj["pitch"] = pitch

            features["dimensions"].append(dim_obj)

        final_confidence = {"overall": 0.9}
        return features, final_confidence, "\n".join(full_text_list)
