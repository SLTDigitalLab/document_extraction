#NB

from fastapi import FastAPI, File, UploadFile
import requests
import time
from starlette.middleware.cors import CORSMiddleware
import re
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Azure credentials
AZURE_ENDPOINT = "https://invoicedetails.cognitiveservices.azure.com/"
AZURE_KEY = ""
INVOICE_MODEL = "prebuilt-invoice"

# Initialize sentence transformer model (loads once at startup)
model = SentenceTransformer('all-MiniLM-L6-v2')

# Pre-compute embeddings for document types
check_examples = [
    "Pay to the order of",
    "Check number routing number account number",
    "Dollars memo signature line",
    "Bank check payment order",
    "Check date payee amount dollars"
]

invoice_examples = [
    "Invoice number date due",
    "Bill to ship to customer",
    "Item description quantity price amount",
    "Subtotal tax total payment",
    "Invoice vendor customer line items"
]

check_embeddings = model.encode(check_examples)
invoice_embeddings = model.encode(invoice_examples)


def is_check_document(result):
    """Use sentence transformers to determine if document is a check"""
    # Extract text from OCR result
    all_text = []
    for page in result.get("analyzeResult", {}).get("pages", []):
        for line in page.get("lines", []):
            all_text.append(line.get("content", ""))

    # Combine first 100 lines
    document_text = " ".join(all_text[:100])

    # Get embedding for document
    doc_embedding = model.encode([document_text])

    # Calculate similarity with check and invoice examples
    check_similarity = cosine_similarity(doc_embedding, check_embeddings).mean()
    invoice_similarity = cosine_similarity(doc_embedding, invoice_embeddings).mean()

    # Return True if more similar to checks
    return check_similarity > invoice_similarity


def extract_check_data(result):
    """Extract check data from OCR results"""
    analyze_result = result.get("analyzeResult", {})

    check_data = {
        "DocumentType": "check",
        "CheckNumber": None,
        "Date": None,
        "PayeeName": None,
        "Amount": None,
        "AmountInWords": None,
        "Memo": None,
        "BankName": None,
        "RoutingNumber": None,
        "AccountNumber": None,
        "PayerName": None,
        "PayerAddress": None
    }

    # Get all text lines
    all_lines = []
    for page in analyze_result.get("pages", []):
        for line in page.get("lines", []):
            all_lines.append(line.get("content", ""))

    # Extract key-value pairs
    for pair in analyze_result.get("keyValuePairs", []):
        key = pair.get("key", {}).get("content", "").lower()
        value = pair.get("value", {}).get("content", "")

        if "pay" in key and "order" in key:
            check_data["PayeeName"] = value
        elif "date" in key:
            check_data["Date"] = value
        elif "memo" in key:
            check_data["Memo"] = value

    # Pattern matching
    for i, line in enumerate(all_lines):
        line_lower = line.lower()

        # Check number
        if i < 3 and line.isdigit() and len(line) <= 6:
            check_data["CheckNumber"] = line

        # Payee name
        if "pay" in line_lower and "order" in line_lower and i + 1 < len(all_lines):
            next_line = all_lines[i + 1].strip()
            if next_line and not next_line.startswith("$"):
                check_data["PayeeName"] = next_line

        # Amount
        if "$" in line or "dollars" in line_lower:
            amount_match = re.search(r'\$?\s*(\d+[,.]?\d*\.?\d*)', line)
            if amount_match:
                check_data["Amount"] = amount_match.group(1).replace(",", "")
            if "dollars" in line_lower:
                check_data["AmountInWords"] = line.strip()

        # Memo
        if "memo" in line_lower and i + 1 < len(all_lines):
            check_data["Memo"] = all_lines[i + 1].strip()

        # Routing and account numbers
        if re.search(r'[:|]?\s*\d{9,}', line):
            numbers = re.findall(r'\d{9,}', line)
            if numbers:
                if not check_data["RoutingNumber"] and len(numbers[0]) >= 9:
                    check_data["RoutingNumber"] = numbers[0]
                if len(numbers) > 1 and not check_data["AccountNumber"]:
                    check_data["AccountNumber"] = numbers[1]

        # Payer info
        if i < 4 and not any(x in line_lower for x in ["pay", "order", "date", "check"]):
            if not check_data["PayerName"] and line.strip():
                check_data["PayerName"] = line.strip()
            elif check_data["PayerName"] and not check_data["PayerAddress"]:
                check_data["PayerAddress"] = line.strip()

    return check_data


def process_invoice(result):
    """Process invoice document"""
    documents = result.get("analyzeResult", {}).get("documents", [])
    if not documents:
        return {"error": "No invoice data found"}

    invoice = documents[0]
    fields = invoice.get("fields", {})

    extracted_data = {
        "DocumentType": "invoice",
        "InvoiceId": fields.get("InvoiceId", {}).get("content"),
        "InvoiceDate": fields.get("InvoiceDate", {}).get("content"),
        "DueDate": fields.get("DueDate", {}).get("content"),
        "VendorName": fields.get("VendorName", {}).get("content"),
        "CustomerName": fields.get("CustomerName", {}).get("content"),
        "CustomerAddress": fields.get("CustomerAddress", {}).get("content"),
        "InvoiceTotal": fields.get("InvoiceTotal", {}).get("content"),
        "Items": []
    }

    # Extract line items
    line_items = fields.get("Items", {}).get("valueArray", [])
    for item in line_items:
        item_fields = item.get("valueObject", {})
        extracted_data["Items"].append({
            "Description": item_fields.get("Description", {}).get("content"),
            "Quantity": item_fields.get("Quantity", {}).get("content"),
            "UnitPrice": item_fields.get("UnitPrice", {}).get("content"),
            "Amount": item_fields.get("Amount", {}).get("content"),
        })

    return extracted_data


@app.post("/upload-invoice/")
async def upload_document(file: UploadFile = File(...)):
    # Determine content type
    content_type = "application/pdf"
    if file.filename.lower().endswith((".jpg", ".jpeg")):
        content_type = "image/jpeg"
    elif file.filename.lower().endswith(".png"):
        content_type = "image/png"

    file_content = await file.read()

    # Send to Azure OCR
    url = f"{AZURE_ENDPOINT}formrecognizer/documentModels/{INVOICE_MODEL}:analyze?api-version=2023-07-31"
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": content_type
    }

    response = requests.post(url, headers=headers, data=file_content)

    if response.status_code != 202:
        return {"error": f"Azure API error: {response.status_code}", "details": response.text}

    result_url = response.headers.get("operation-location")
    if not result_url:
        return {"error": "No operation location in response"}

    # Poll for result
    max_attempts = 30
    attempts = 0

    while attempts < max_attempts:
        result = requests.get(result_url, headers={"Ocp-Apim-Subscription-Key": AZURE_KEY}).json()
        status = result.get("status")

        if status in ["succeeded", "failed"]:
            break

        time.sleep(1)
        attempts += 1

    if status == "failed":
        return {"error": "Document processing failed", "details": result}

    if attempts >= max_attempts:
        return {"error": "Processing timeout"}

    # Classify and extract
    try:
        if is_check_document(result):
            return extract_check_data(result)
        else:
            return process_invoice(result)
    except Exception as e:
        import traceback
        return {
            "error": f"Extraction failed: {str(e)}",
            "traceback": traceback.format_exc()
        }