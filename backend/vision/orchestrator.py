import os
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_onednn"] = "0"
import argparse
import json
import sys
import time
# FIX: Import torch before paddle to avoid Windows DLL conflict (shm.dll)
import torch
import cv2

from pipeline import ImagePipeline
from roi_detector import ROIDetector
from ocr_engine import OCREngine
from extractor import Extractor

def main():
    parser = argparse.ArgumentParser(description="Unified OCR and Symbol Engine")
    parser.add_argument("input_image", help="Path to the input image file")
    parser.add_argument("--output_dir", help="Directory to save debug images", default=None)
    parser.add_argument("--debug", action="store_true", help="Save debug annotated images")
    
    args = parser.parse_args()
    input_path = args.input_image
    output_dir = args.output_dir
    save_debug = args.debug
    
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(input_path))
        
    if save_debug:
        os.makedirs(output_dir, exist_ok=True)
        
    start_time = time.time()
    
    try:
        # 1. OpenCV Preprocessing
        pipeline = ImagePipeline(target_dpi=300)
        clean_img, contrast_img = pipeline.process(input_path)
        
        # Extract OpenCV features (circles, lines, contours)
        opencv_features = pipeline.extract_opencv_features(clean_img)
        
        # 2. ROI Detection (Optional depending on usage, but we'll run it)
        detector = ROIDetector()
        rois = detector.detect(clean_img, contrast_img)
        
        # 3. OCR Engine
        ocr_engine = OCREngine()
        clean_bgr = cv2.cvtColor(clean_img, cv2.COLOR_GRAY2BGR)
        
        # We'll just run full image OCR for the extractor to have all text
        # (Could also run per ROI and stitch, but full image is more reliable for regex)
        ocr_tokens = ocr_engine.process(clean_bgr)
        
        if save_debug:
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            ocr_engine.draw_debug(clean_bgr, ocr_tokens, os.path.join(output_dir, f"{base_name}_ocr_debug.png"))
            
        # 4. Extraction Engine
        extractor = Extractor()
        features, confidence_summary, full_text = extractor.extract_features(ocr_tokens, opencv_features)
        
        # 5. Format response
        response = {
            "success": True,
            "file": input_path,
            "pages_processed": 1,
            "ocr": {
                "tokens": ocr_tokens,
                "full_text": full_text
            },
            "opencv": opencv_features,
            "features": features,
            "standard_ed_draft": {}, # Placeholder for later mapping if needed
            "confidence_summary": confidence_summary
        }
        
        print(json.dumps(response))
        sys.exit(0)
        
    except Exception as e:
        error_response = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_response))
        sys.exit(1)

if __name__ == "__main__":
    main()
