import re
import math

class Extractor:
    def __init__(self):
        pass
        
    def bbox_distance(self, b1, b2):
        # b1, b2: [xmin, ymin, xmax, ymax]
        x_dist = max(0, max(b1[0], b2[0]) - min(b1[2], b2[2]))
        y_dist = max(0, max(b1[1], b2[1]) - min(b1[3], b2[3]))
        return math.sqrt(x_dist**2 + y_dist**2)

    def extract_features(self, ocr_data, opencv_features=None):
        features = {
            "title_block": {},
            "dimensions": [],
            "materials": [],
            "surface_finish": [],
            "notes": [],
            "rejected_candidates": []
        }
        
        confidence_summary = {}
        full_text_list = []
        tb_keywords = ["REV", "DWG NO", "PART NO", "QTY", "SCALE"]
        materials_pattern = r'\b(MS|SS304|SS316|EN8|AL|CI|ALUMINIUM|STEEL)\b'
        surface_finish_pattern = r'(?:Ra|Rz)\s*(\d+(?:\.\d+)?)'

        if not opencv_features:
            opencv_features = {"circles": [], "lines": [], "contours": []}

        candidates = []
        other_tokens = []

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

            is_tb = False
            for kw in tb_keywords:
                if kw in text_upper:
                    features["title_block"][kw] = clean_text
                    is_tb = True
            
            if is_tb:
                continue

            mat_match = re.search(materials_pattern, text_upper)
            if mat_match:
                features["materials"].append({"value": mat_match.group(0), "confidence": conf})
                continue
                
            sf_match = re.search(surface_finish_pattern, clean_text)
            if sf_match:
                features["surface_finish"].append({"value": sf_match.group(0), "confidence": conf})
                continue
                
            if "NOTE" in text_upper:
                features["notes"].append(clean_text)
                continue
            
            if re.search(r'\d', clean_text):
                candidates.append(item)
            else:
                other_tokens.append(item)

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

