import PyPDF2
import sys

def pdf_to_text(pdf_path, output_path):
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            
            for page_num in range(len(pdf_reader.pages)):
                page = pdf_reader.pages[page_num]
                text += page.extract_text()
            
        with open(output_path, 'w', encoding='utf-8') as output_file:
            output_file.write(text)
        
        print(f"PDF converted successfully to {output_path}")
        
    except Exception as e:
        print(f"Error converting PDF: {str(e)}")

if __name__ == "__main__":
    pdf_to_text("Recall-API-documentation.pdf", "Recall-API-documentation.txt")