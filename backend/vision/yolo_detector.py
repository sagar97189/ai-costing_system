import os
import cv2
import numpy as np

# A default mapping assuming a placeholder YOLO model (like COCO) is being used.
# In production, when a custom engineering model is used, this mapping will 
# translate the model's class IDs to engineering symbol types.
DEFAULT_CLASS_MAPPING = {
    # e.g., if the custom model returns class 0 for 'hole', we'd map it.
    # Since we use yolov8n.pt as placeholder, these IDs are meaningless for engineering,
    # but the architecture is ready.
    0: "hole",
    1: "datum",
    2: "surface_finish",
    3: "weld_symbol",
    4: "gdt_frame"
}

class YOLODetector:
    def __init__(self, model_path="yolov8n.pt", class_mapping=None):
        # Import inside init to keep CLI fast when not used
        from ultralytics import YOLO
        
        # Load the model. Ultralytics will auto-download yolov8n.pt if it doesn't exist
        self.model = YOLO(model_path)
        self.class_mapping = class_mapping or DEFAULT_CLASS_MAPPING
        
    def process(self, image_np, conf_threshold=0.25):
        """
        Runs YOLO detection on a numpy image array.
        Returns a list of dicts: [{'class': str, 'confidence': float, 'bbox': [x1, y1, x2, y2]}]
        """
        results = self.model.predict(source=image_np, conf=conf_threshold, save=False, verbose=False)
        
        extracted = []
        if not results:
            return extracted
            
        result = results[0] # Single image prediction
        
        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            conf = float(box.conf[0].item())
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            # Use class mapping if available, otherwise use model's internal names
            cls_name = self.class_mapping.get(cls_id, result.names.get(cls_id, f"class_{cls_id}"))
            
            extracted.append({
                "class": cls_name,
                "confidence": conf,
                "bbox": [int(x1), int(y1), int(x2), int(y2)]
            })
            
        return extracted
        
    def draw_debug(self, image_np, extracted_data, output_path):
        """Draws bounding boxes and labels on the image for debugging."""
        debug_img = image_np.copy()
        
        for item in extracted_data:
            x1, y1, x2, y2 = item['bbox']
            cls_name = item['class']
            conf = item['confidence']
            
            # Draw box (Orange for symbols)
            cv2.rectangle(debug_img, (x1, y1), (x2, y2), (0, 165, 255), 2)
            # Put text above box
            label = f"{cls_name} ({conf:.2f})"
            cv2.putText(debug_img, label, (x1, max(0, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 2)
            
        cv2.imwrite(output_path, debug_img)
        return debug_img
