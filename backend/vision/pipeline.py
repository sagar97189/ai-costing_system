import cv2
import numpy as np
import math

class ImagePipeline:
    def __init__(self, target_dpi=300):
        self.target_dpi = target_dpi
        
    def process(self, image_path):
        """Runs the full preprocessing pipeline on the given image path."""
        # Check if PDF
        if image_path.lower().endswith(".pdf"):
            import fitz
            doc = fitz.open(image_path)
            if doc.page_count == 0:
                raise ValueError("PDF has no pages")
            page = doc.load_page(0)
            pix = page.get_pixmap(dpi=300)
            # Convert fitz pixmap to numpy array for cv2
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            # if it has alpha channel, convert to BGR, else RGB to BGR
            if pix.n == 4:
                img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
            else:
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            doc.close()
        else:
            # Read image natively
            img = cv2.imread(image_path)
            
        if img is None:
            raise ValueError(f"Could not read image at {image_path}")
            
        processed = img.copy()
        
        # 1. DPI Normalization (Resize to approximate 300 DPI if too small)
        # Assuming typical drawing is A4/A3, we scale it up if height < 2000
        height, width = processed.shape[:2]
        if height < 2000:
            scale = 2000 / height
            processed = cv2.resize(processed, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            
        # Convert to grayscale for most operations
        gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
        
        # 2. Border Removal
        gray = self.remove_borders(gray)
        
        # 3. Deskewing
        gray = self.deskew(gray)
        
        # 4. Noise Removal & Sharpening
        # Apply slight blur to remove high-frequency noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        # Unsharp masking for sharpening
        sharpened = cv2.addWeighted(gray, 1.5, blurred, -0.5, 0)
        
        # 5. Contrast (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast = clahe.apply(sharpened)
        
        # 6. Thresholding (Adaptive)
        binary = cv2.adaptiveThreshold(
            contrast, 255, 
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        # 7. Morphological Operations (Opening/Closing to clean text)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        # Remove small black noise
        opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel, iterations=1)
        # Connect text segments
        cleaned = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=1)
        
        return cleaned, contrast # return binary cleaned and grayscale contrast image
        
    def remove_borders(self, gray_img):
        """Removes dark borders from scanned images."""
        # Threshold to find borders
        _, thresh = cv2.threshold(gray_img, 50, 255, cv2.THRESH_BINARY)
        # Find contours
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return gray_img
            
        # Find largest contour which is presumably the page
        largest_contour = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest_contour)
        
        # Crop if the contour is reasonably large
        img_h, img_w = gray_img.shape
        if w > 0.5 * img_w and h > 0.5 * img_h:
            return gray_img[y:y+h, x:x+w]
        return gray_img
        
    def deskew(self, image):
        """Calculates skew angle and rotates image to straighten it."""
        # Use edge detection and Hough lines to find dominant angle
        edges = cv2.Canny(image, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=100, maxLineGap=10)
        
        if lines is None:
            return image
            
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
            # We only care about angles close to horizontal (-45 to 45)
            if -45 < angle < 45:
                angles.append(angle)
                
        if not angles:
            return image
            
        median_angle = np.median(angles)
        
        if abs(median_angle) < 0.5: # Almost straight
            return image
            
        # Rotate image
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        
        # Keep background white (255)
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))
        return rotated
