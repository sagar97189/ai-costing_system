import argparse
import json
import os
import sys
import time

# FIX: Import torch before paddle to avoid Windows DLL conflict (shm.dll)
import torch

import cv2
import concurrent.futures

from pipeline import ImagePipeline
from roi_detector import ROIDetector
from ocr_engine import OCREngine
from yolo_detector import YOLODetector

def run_ocr(ocr_engine, image_np, rois, output_dir, base_name, save_debug):
    """Runs OCR on all ROIs and the main image (if requested)."""
    ocr_results = []
    
    # If no ROIs, fallback to full image OCR
    if not rois:
        extracted = ocr_engine.process(image_np)
        if save_debug:
            ocr_engine.draw_debug(image_np, extracted, os.path.join(output_dir, f"{base_name}_debug_ocr_full.png"))
        
        ocr_results.append({
            "type": "full_image",
            "results": extracted
        })
        return ocr_results
        
    # Process each ROI
    for i, roi in enumerate(rois):
        x, y, w, h = roi['box']
        roi_img = image_np[y:y+h, x:x+w]
        
        extracted = ocr_engine.process(roi_img)
        
        # Adjust bounding boxes to be relative to the full image coordinates
        for item in extracted:
            bx1, by1, bx2, by2 = item['bbox']
            item['bbox'] = [bx1 + x, by1 + y, bx2 + x, by2 + y]
            
        if save_debug:
            ocr_engine.draw_debug(roi_img, extracted, os.path.join(output_dir, f"{base_name}_debug_ocr_roi_{roi['type']}_{i}.png"))
            
        ocr_results.append({
            "type": roi['type'],
            "results": extracted
        })
        
    return ocr_results

def run_yolo(yolo_engine, image_np, output_dir, base_name, save_debug):
    """Runs YOLO on the full image."""
    extracted = yolo_engine.process(image_np)
    
    if save_debug:
        yolo_engine.draw_debug(image_np, extracted, os.path.join(output_dir, f"{base_name}_debug_yolo.png"))
        
    return extracted

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
        # 1. OpenCV Preprocessing (Sequential)
        pipeline = ImagePipeline(target_dpi=300)
        clean_img, contrast_img = pipeline.process(input_path)
        
        detector = ROIDetector()
        rois = detector.detect(clean_img, contrast_img)
        
        # For the final JSON, we only need basic ROI coordinates
        roi_results = []
        for i, roi in enumerate(rois):
            x, y, w, h = roi['box']
            roi_results.append({
                "type": roi['type'],
                "box": {"x": x, "y": y, "w": w, "h": h}
            })
            
        # Initialize engines
        ocr_engine = OCREngine()
        yolo_engine = YOLODetector()
        
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        
        # 2. Parallel Execution of OCR and YOLO
        # Convert grayscale (clean_img) to BGR because PaddleOCR/YOLO usually expect 3 channels
        clean_bgr = cv2.cvtColor(clean_img, cv2.COLOR_GRAY2BGR)
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_ocr = executor.submit(run_ocr, ocr_engine, clean_bgr, rois, output_dir, base_name, save_debug)
            future_yolo = executor.submit(run_yolo, yolo_engine, clean_bgr, output_dir, base_name, save_debug)
            
            ocr_output = future_ocr.result()
            yolo_output = future_yolo.result()
            
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # 3. Unified JSON Response
        response = {
            "image": {
                "dpi": 300,
                "rotation": 0.0,
                "deskewed": True
            },
            "rois": roi_results,
            "ocr": ocr_output,
            "symbols": yolo_output,
            "metadata": {
                "processing_time_ms": processing_time_ms,
                "ocr_engine": "PaddleOCR",
                "symbol_engine": "YOLOv8"
            }
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
