import os
import cv2
import numpy as np

# Fix for PaddlePaddle 3.x CPU crash with oneDNN
os.environ["FLAGS_enable_pir_api"] = "0"

class OCREngine:
    def __init__(self):
        # We import here so it doesn't slow down CLI parsing if we don't need it immediately
        from paddleocr import PaddleOCR
        # Initialize PaddleOCR
        # use_angle_cls=True allows it to automatically detect text orientation
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
        
    def process(self, image_np):
        """
        Runs OCR on a numpy image array.
        Returns a list of dicts: [{'text': str, 'confidence': float, 'bbox': [x1, y1, x2, y2]}]
        """
        # PaddleOCR expects BGR format (standard OpenCV format)
        results = self.ocr.ocr(image_np, cls=True)
        
        extracted = []
        if not results or results[0] is None:
            return extracted
            
        for line in results[0]:
            # line structure: [[ [x1, y1], [x2, y2], [x3, y3], [x4, y4] ], (text, confidence)]
            box, (text, conf) = line
            # Convert 4 points to a standard [xmin, ymin, xmax, ymax] bounding box
            x_coords = [p[0] for p in box]
            y_coords = [p[1] for p in box]
            bbox = [int(min(x_coords)), int(min(y_coords)), int(max(x_coords)), int(max(y_coords))]
            
            extracted.append({
                "text": text,
                "confidence": float(conf),
                "bbox": bbox
            })
            
        return extracted
        
    def draw_debug(self, image_np, extracted_data, output_path):
        """Draws bounding boxes and text on the image for debugging."""
        debug_img = image_np.copy()
        
        for item in extracted_data:
            x1, y1, x2, y2 = item['bbox']
            text = item['text']
            conf = item['confidence']
            
            # Draw box
            cv2.rectangle(debug_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            # Put text above box
            label = f"{text} ({conf:.2f})"
            cv2.putText(debug_img, label, (x1, max(0, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
            
        cv2.imwrite(output_path, debug_img)
        return debug_img
