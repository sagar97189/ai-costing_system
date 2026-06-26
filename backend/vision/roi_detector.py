import cv2
import numpy as np

class ROIDetector:
    def __init__(self):
        pass
        
    def detect(self, binary_img, gray_img):
        """
        Detects Regions of Interest (ROIs) from the preprocessed images.
        Returns a list of dicts: [{'type': 'title_block', 'box': (x,y,w,h)}, ...]
        """
        rois = []
        
        # Invert binary image (so text/lines are white, background is black)
        # Assuming the pipeline outputs black text on white background (THRESH_BINARY)
        # If it's already inverted, skip this. Let's assume standard binary: text is black (0).
        inverted = cv2.bitwise_not(binary_img)
        
        # Detect Title Block (usually bottom right)
        tb_box = self._detect_title_block(inverted)
        if tb_box:
            rois.append({
                'type': 'title_block',
                'box': tb_box
            })
            
        # Detect Dimension/Notes areas
        # We can use morphological dilation to group text blocks
        notes_boxes = self._detect_text_blocks(inverted, exclude_box=tb_box)
        for box in notes_boxes:
            rois.append({
                'type': 'dimension_area',
                'box': box
            })
            
        return rois
        
    def _detect_title_block(self, inverted_img):
        """Finds the title block, typically a large rectangular grid in bottom-right."""
        h, w = inverted_img.shape
        
        # Dilate to connect text and lines into blocks
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (30, 30))
        dilated = cv2.dilate(inverted_img, kernel, iterations=1)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        candidates = []
        for c in contours:
            x, y, bw, bh = cv2.boundingRect(c)
            # Title block is usually in the bottom right quadrant
            if x > w/2 and y > h/2 and bw > 100 and bh > 50:
                candidates.append((x, y, bw, bh))
                
        if not candidates:
            # Fallback: Just return a static bottom-right crop if heuristic fails
            return (int(w*0.7), int(h*0.8), int(w*0.3), int(h*0.2))
            
        # Get the one closest to bottom right
        # Distance to bottom right: (w - (x+bw))^2 + (h - (y+bh))^2
        best = min(candidates, key=lambda b: (w - (b[0]+b[2]))**2 + (h - (b[1]+b[3]))**2)
        return best
        
    def _detect_text_blocks(self, inverted_img, exclude_box=None):
        """Finds text/dimension blocks using dilation and contour finding."""
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 10))
        dilated = cv2.dilate(inverted_img, kernel, iterations=2)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        boxes = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            # Filter out noise (too small) or full page (too large)
            if w > 30 and h > 15 and (w*h) < (inverted_img.shape[0]*inverted_img.shape[1]*0.5):
                # Check overlap with title block
                if exclude_box:
                    ex, ey, ew, eh = exclude_box
                    # simple intersection check
                    if x < ex+ew and x+w > ex and y < ey+eh and y+h > ey:
                        continue
                boxes.append((x, y, w, h))
                
        # Limit to top N boxes to avoid thousands of small boxes
        boxes = sorted(boxes, key=lambda b: b[2]*b[3], reverse=True)[:5]
        return boxes
