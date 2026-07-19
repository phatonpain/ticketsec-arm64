import fitz  # PyMuPDF
import os

pdf_path = r'c:\Users\crust\Downloads\KIMICODE_M8_REFERENCE_REDESIGN.pdf'
out_dir = r'D:\ComfyUI\ticketsec-arm64-dashboard\design-refs'
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
print(f"PDF has {len(doc)} pages")

# Extract text
full_text = []
for i, page in enumerate(doc):
    text = page.get_text()
    full_text.append(f"--- Page {i+1} ---\n{text}\n")
    print(f"Page {i+1} text length: {len(text)}")

with open(os.path.join(out_dir, 'mission_text.txt'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(full_text))

# Extract images
img_count = 0
for i, page in enumerate(doc):
    images = page.get_images(full=True)
    print(f"Page {i+1} images: {len(images)}")
    for img_index, img in enumerate(images, start=1):
        xref = img[0]
        pix = fitz.Pixmap(doc, xref)
        if pix.n > 4:  # CMYK: convert to RGB
            pix = fitz.Pixmap(fitz.csRGB, pix)
        img_path = os.path.join(out_dir, f'page{i+1}_img{img_index}.png')
        pix.save(img_path)
        pix = None
        img_count += 1
        print(f"Saved {img_path}")

print(f"Extracted {img_count} images")
doc.close()
