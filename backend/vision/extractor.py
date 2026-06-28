import re

class Extractor:
    def __init__(self):
        # We will parse dimensions into a dictionary with keys matching the request
        pass
        
    def extract_features(self, ocr_data):
        features = {
            "title_block": {},
            "dimensions": {
                "diameters": [],
                "inner_diameters": [],
                "outer_diameters": [],
                "linear": [],
                "tolerances": [],
                "threads": [],
                "holes": [],
                "chamfers": [],
                "angles": [],
                "rejected_candidates": []
            },
            "materials": [],
            "surface_finish": [],
            "notes": []
        }
        
        confidence_summary = {}
        full_text_list = []
        tb_keywords = ["REV", "DWG NO", "PART NO", "QTY", "SCALE"]
        materials_pattern = r'\b(MS|SS304|SS316|EN8|AL|CI|ALUMINIUM|STEEL)\b'
        surface_finish_pattern = r'(?:Ra|Rz)\s*(\d+(?:\.\d+)?)'

        def parse_tolerance(text):
            plus, minus = 0.0, 0.0
            tol_match = re.search(r'(±)\s*(\d+(?:\.\d+)?)', text)
            if tol_match:
                val = float(tol_match.group(2))
                return {"plus": val, "minus": -val}
                
            pm_match = re.search(r'\+\s*(\d+(?:\.\d+)?)\s*/\s*-\s*(\d+(?:\.\d+)?)', text)
            if pm_match:
                return {"plus": float(pm_match.group(1)), "minus": -float(pm_match.group(2))}
                
            # e.g., "50 -0.015"
            minus_match = re.search(r'(?<=\s)-\s*(\d+(?:\.\d+)?)', text)
            if minus_match:
                minus = -float(minus_match.group(1))
            
            plus_match = re.search(r'(?<=\s)\+\s*(\d+(?:\.\d+)?)', text)
            if plus_match:
                plus = float(plus_match.group(1))
                
            if minus != 0.0 or plus != 0.0:
                return {"plus": plus, "minus": minus}
                
            return None

        def extract_number(text):
            m = re.search(r'\d+(?:\.\d+)?', text)
            return float(m.group(0)) if m else None

        for item in ocr_data:
            text = item.get("text", "").strip()
            conf = item.get("confidence", 0.0)
            bbox = item.get("bbox", [0, 0, 0, 0])
            full_text_list.append(text)
            
            # --- Rejection Rules ---
            is_rejected = False
            
            # Standalone single digits or single letters A-D
            if re.match(r'^[1-9]$', text) or re.match(r'^[A-D]$', text.upper()):
                is_rejected = True
                
            # Sheet / Revision / Item
            text_upper = text.upper()
            if "SHEET" in text_upper or re.match(r'^REV\s*\d+', text_upper):
                is_rejected = True
                
            # Title block
            is_tb = False
            for kw in tb_keywords:
                if kw in text_upper:
                    features["title_block"][kw] = text
                    is_tb = True
            
            if is_rejected or is_tb:
                if is_rejected and re.search(r'\d', text):
                    features["dimensions"]["rejected_candidates"].append({
                        "raw_text": text, "reason": "grid_or_metadata"
                    })
                continue
                
            # --- Feature Mapping ---
            extracted = False
            
            # Materials
            mat_match = re.search(materials_pattern, text_upper)
            if mat_match:
                features["materials"].append({"value": mat_match.group(0), "confidence": conf})
                extracted = True
                
            # Surface Finish
            sf_match = re.search(surface_finish_pattern, text)
            if sf_match:
                features["surface_finish"].append({"value": sf_match.group(0), "confidence": conf})
                extracted = True
                
            # Notes
            if "NOTE" in text_upper:
                features["notes"].append(text)
                extracted = True

            # --- Dimensions ---
            tol = parse_tolerance(text)
            nom = extract_number(text)
            
            dim_obj = {
                "raw_text": text,
                "type": "unknown_dimension",
                "nominal_value": nom,
                "unit": "mm",
                "tolerance": tol,
                "confidence": conf,
                "bbox": bbox,
                "requires_engineer_review": False
            }

            # Diameter
            if re.search(r'(?:Ø|⌀|DIA|DIAMETER)\s*(\d+(?:\.\d+)?)', text_upper):
                dim_obj["type"] = "diameter"
                dim_obj["confidence"] = min(1.0, conf + 0.1)
                features["dimensions"]["diameters"].append(dim_obj)
                extracted = True
            # Outer Diameter
            elif re.search(r'(?:OD|OUTER DIA)\s*(\d+(?:\.\d+)?)', text_upper):
                dim_obj["type"] = "outer_diameter"
                dim_obj["confidence"] = min(1.0, conf + 0.1)
                features["dimensions"]["outer_diameters"].append(dim_obj)
                extracted = True
            # Inner Diameter
            elif re.search(r'(?:ID|INNER DIA)\s*(\d+(?:\.\d+)?)', text_upper):
                dim_obj["type"] = "inner_diameter"
                dim_obj["confidence"] = min(1.0, conf + 0.1)
                features["dimensions"]["inner_diameters"].append(dim_obj)
                extracted = True
            # Radius
            elif re.search(r'(?:R|RAD)\s*(\d+(?:\.\d+)?)', text_upper) and not re.search(r'DEG|°', text_upper):
                dim_obj["type"] = "radius"
                dim_obj["confidence"] = min(1.0, conf + 0.1)
                features["dimensions"]["linear"].append(dim_obj) # Mapping R to linear or a specific array if requested
                extracted = True
            # Thread
            elif re.search(r'(M\d+(?:[xX]\d+(?:\.\d+)?)?)', text_upper):
                dim_obj["type"] = "thread"
                dim_obj["confidence"] = min(1.0, conf + 0.1)
                features["dimensions"]["threads"].append(dim_obj)
                extracted = True
            # Hole
            elif re.search(r'(\d+)\s*(?:HOLES|X|NOS|NOS\.)\s*(?:Ø|DIA|DIAMETER|⌀)?\s*(\d+(?:\.\d+)?)', text_upper):
                dim_obj["type"] = "hole"
                dim_obj["confidence"] = min(1.0, conf + 0.1)
                features["dimensions"]["holes"].append(dim_obj)
                extracted = True
            # PCD
            elif re.search(r'(?:PCD|P\.C\.D\.)\s*(\d+(?:\.\d+)?)', text_upper):
                dim_obj["type"] = "pcd"
                features["dimensions"]["holes"].append(dim_obj) # Often grouped with holes/PCD array
                extracted = True
            # Chamfer
            elif re.search(r'(?:C\d+|\d+\s*x\s*\d+°|CHAMFER)', text_upper):
                dim_obj["type"] = "chamfer"
                features["dimensions"]["chamfers"].append(dim_obj)
                extracted = True
            # Angle
            elif re.search(r'(\d+(?:\.\d+)?)\s*(?:°|DEG)', text_upper):
                dim_obj["type"] = "angle"
                features["dimensions"]["angles"].append(dim_obj)
                extracted = True
            # Linear or pure tolerance
            elif re.search(r'^\s*(\d+(?:\.\d+)?)\s*$', text) or tol is not None:
                if tol is not None:
                    dim_obj["type"] = "tolerance"
                    dim_obj["confidence"] = min(1.0, conf + 0.1)
                    features["dimensions"]["tolerances"].append(dim_obj)
                    extracted = True
                else:
                    # Isolated integer without tolerance or symbol
                    # Set low confidence, might be a BOM item or random label
                    dim_obj["type"] = "linear"
                    dim_obj["confidence"] = max(0.1, conf - 0.3)
                    dim_obj["requires_engineer_review"] = True
                    features["dimensions"]["linear"].append(dim_obj)
                    extracted = True

            if not extracted and re.search(r'\d', text):
                features["dimensions"]["rejected_candidates"].append({
                    "raw_text": text, "reason": "unmatched_pattern"
                })

        final_confidence = {"overall": 0.9} # Placeholder
        return features, final_confidence, "\n".join(full_text_list)
