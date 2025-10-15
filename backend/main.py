from fastapi import FastAPI, File, UploadFile
import requests
import time
from starlette.middleware.cors import CORSMiddleware

app = FastAPI()

# CORS Middleware - MUST BE ENABLED
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite default port
    allow_credentials=True,  # Fixed typo
    allow_methods=["*"],
    allow_headers=["*"],
)

# Azure credentials
AZURE_ENDPOINT = "https://invoicedetails.cognitiveservices.azure.com/"
AZURE_KEY = "Enter Your Azure Key Here"
INVOICE_MODEL = "prebuilt-invoice"


@app.post("/upload-invoice/")
async def upload_invoice(file: UploadFile = File(...)):
    # Determine content type based on file extension
    content_type = "application/pdf"
    if file.filename.lower().endswith((".jpg", ".jpeg")):
        content_type = "image/jpeg"
    elif file.filename.lower().endswith(".png"):
        content_type = "image/png"

    # Send file to Azure Form Recognizer
    url = f"{AZURE_ENDPOINT}formrecognizer/documentModels/{INVOICE_MODEL}:analyze?api-version=2023-07-31"
    headers = {
        "Ocp-Apim-Subscription-Key": AZURE_KEY,
        "Content-Type": content_type
    }

    file_content = await file.read()
    response = requests.post(url, headers=headers, data=file_content)

    if response.status_code != 202:
        return {"error": response.text}

    # Poll the result
    result_url = response.headers["operation-location"]

    while True:
        result = requests.get(
            result_url,
            headers={"Ocp-Apim-Subscription-Key": AZURE_KEY}
        ).json()
        status = result["status"]
        if status in ["succeeded", "failed"]:
            break
        time.sleep(1)

    if status == "failed":
        return {"error": "Invoice processing failed"}

    # Extract useful fields
    documents = result.get("analyzeResult", {}).get("documents", [])
    if not documents:
        return {"error": "No invoice data found"}

    invoice = documents[0]
    fields = invoice.get("fields", {})

    # Extract clean data
    extracted_data = {
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