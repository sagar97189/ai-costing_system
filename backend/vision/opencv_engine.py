import argparse
import json
import os
import sys
import cv2
from pipeline import ImagePipeline
from roi_detector import ROIDetector

def main():
    parser = argparse.ArgumentParser(description="OpenCV Engine for Engineering Drawings")
    parser.add_argument("input_image", help="Path to the input image file")
    parser.add_argument("--output_dir", help="Directory to save the output clean image and ROIs", default=None)
    
    args = parser.parse_args()
    
    input_path = args.input_image
    output_dir = args.output_dir
    
    if output_dir is None:
        # Default to the same directory as input
        output_dir = os.path.dirname(os.path.abspath(input_path))
        
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        # 1. Process Image
        pipeline = ImagePipeline(target_dpi=300)
        clean_img, contrast_img = pipeline.process(input_path)
        
        # Save clean image
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        clean_path = os.path.join(output_dir, f"{base_name}_clean.png")
        cv2.imwrite(clean_path, clean_img)
        
        # 2. Detect ROIs
        detector = ROIDetector()
        # Pass both binary(cleaned) and contrast (grayscale) to detector
        # Currently the pipeline returns a binary image as 'cleaned'
        rois = detector.detect(clean_img, contrast_img)
        
        # Save ROI crops
        roi_results = []
        for i, roi in enumerate(rois):
            x, y, w, h = roi['box']
            roi_crop = clean_img[y:y+h, x:x+w]
            
            roi_type = roi['type']
            roi_filename = f"{base_name}_roi_{roi_type}_{i}.png"
            roi_path = os.path.join(output_dir, roi_filename)
            
            cv2.imwrite(roi_path, roi_crop)
            
            roi_results.append({
                "type": roi_type,
                "path": roi_path,
                "box": {"x": x, "y": y, "w": w, "h": h}
            })
            
        # 3. Prepare JSON response
        response = {
            "success": True,
            "clean_image_path": clean_path,
            "rotation": 0.0, # Placeholder for detected orientation rotation
            "deskewed": True,
            "dpi": 300,
            "rois": roi_results
        }
        
        # Output strictly JSON to stdout
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
