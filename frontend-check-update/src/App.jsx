import { useState } from 'react';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extractedData, setExtractedData] = useState('');
  const [documentType, setDocumentType] = useState(null); // 'invoice' or 'check'
  const [isLoading, setIsLoading] = useState(false);
  const [isUploadingToERP, setIsUploadingToERP] = useState(false);
  const [error, setError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Convert Invoice JSON to human-readable format
  const invoiceToHumanReadable = (data) => {
    let readable = '═══════════════════════════════════════════\n';
    readable += '           INVOICE INFORMATION\n';
    readable += '═══════════════════════════════════════════\n\n';
    
    readable += `Invoice ID      : ${data.InvoiceId || 'N/A'}\n`;
    readable += `Invoice Date    : ${data.InvoiceDate || 'N/A'}\n`;
    readable += `Due Date        : ${data.DueDate || 'N/A'}\n`;
    readable += `Vendor Name     : ${data.VendorName || 'N/A'}\n`;
    readable += `Customer Name   : ${data.CustomerName || 'N/A'}\n`;
    readable += `Customer Address: ${data.CustomerAddress || 'N/A'}\n`;
    readable += `Invoice Total   : ${data.InvoiceTotal || 'N/A'}\n\n`;
    
    readable += '═══════════════════════════════════════════\n';
    readable += '              LINE ITEMS\n';
    readable += '═══════════════════════════════════════════\n\n';
    
    if (data.Items && data.Items.length > 0) {
      data.Items.forEach((item, index) => {
        readable += `Item ${index + 1}:\n`;
        readable += `  Description : ${item.Description || 'N/A'}\n`;
        readable += `  Quantity    : ${item.Quantity || 'N/A'}\n`;
        readable += `  Unit Price  : ${item.UnitPrice || 'N/A'}\n`;
        readable += `  Amount      : ${item.Amount || 'N/A'}\n`;
        readable += `\n`;
      });
    } else {
      readable += 'No items found\n';
    }
    
    return readable;
  };

  // Convert Check JSON to human-readable format
  const checkToHumanReadable = (data) => {
    let readable = '═══════════════════════════════════════════\n';
    readable += '            CHECK INFORMATION\n';
    readable += '═══════════════════════════════════════════\n\n';
    
    readable += `Check Number    : ${data.CheckNumber || 'N/A'}\n`;
    readable += `Date            : ${data.Date || 'N/A'}\n`;
    readable += `Payee Name      : ${data.PayeeName || 'N/A'}\n`;
    readable += `Amount          : ${data.Amount || 'N/A'}\n`;
    readable += `Amount in Words : ${data.AmountInWords || 'N/A'}\n`;
    readable += `Memo            : ${data.Memo || 'N/A'}\n\n`;
    
    readable += '═══════════════════════════════════════════\n';
    readable += '          PAYER INFORMATION\n';
    readable += '═══════════════════════════════════════════\n\n';
    
    readable += `Payer Name      : ${data.PayerName || 'N/A'}\n`;
    readable += `Payer Address   : ${data.PayerAddress || 'N/A'}\n\n`;
    
    readable += '═══════════════════════════════════════════\n';
    readable += '          BANKING INFORMATION\n';
    readable += '═══════════════════════════════════════════\n\n';
    
    readable += `Bank Name       : ${data.BankName || 'N/A'}\n`;
    readable += `Routing Number  : ${data.RoutingNumber || 'N/A'}\n`;
    readable += `Account Number  : ${data.AccountNumber || 'N/A'}\n`;
    
    return readable;
  };

  // Main conversion function
  const jsonToHumanReadable = (jsonData) => {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      if (data.DocumentType === 'check') {
        return checkToHumanReadable(data);
      } else {
        return invoiceToHumanReadable(data);
      }
    } catch (err) {
      console.error('Error converting to human-readable:', err);
      return 'Error displaying data';
    }
  };

  // Convert human-readable Invoice back to JSON
  const invoiceToJson = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const jsonData = {
      DocumentType: 'invoice',
      InvoiceId: null,
      InvoiceDate: null,
      DueDate: null,
      VendorName: null,
      CustomerName: null,
      CustomerAddress: null,
      InvoiceTotal: null,
      Items: []
    };

    let currentItem = null;
    let isInItems = false;

    for (let line of lines) {
      if (line.includes('═') || line.includes('INVOICE INFORMATION')) {
        continue;
      }
      
      if (line === 'LINE ITEMS') {
        isInItems = true;
        continue;
      }

      if (!isInItems) {
        if (line.includes('Invoice ID')) {
          jsonData.InvoiceId = extractValue(line);
        } else if (line.includes('Invoice Date')) {
          jsonData.InvoiceDate = extractValue(line);
        } else if (line.includes('Due Date')) {
          jsonData.DueDate = extractValue(line);
        } else if (line.includes('Vendor Name')) {
          jsonData.VendorName = extractValue(line);
        } else if (line.includes('Customer Name')) {
          jsonData.CustomerName = extractValue(line);
        } else if (line.includes('Customer Address')) {
          jsonData.CustomerAddress = extractValue(line);
        } else if (line.includes('Invoice Total')) {
          const val = extractValue(line);
          jsonData.InvoiceTotal = val === 'N/A' ? null : val;
        }
      } else {
        if (line.startsWith('Item ')) {
          if (currentItem) {
            jsonData.Items.push(currentItem);
          }
          currentItem = {
            Description: null,
            Quantity: null,
            UnitPrice: null,
            Amount: null
          };
        } else if (currentItem) {
          if (line.includes('Description')) {
            currentItem.Description = extractValue(line);
          } else if (line.includes('Quantity')) {
            currentItem.Quantity = extractValue(line);
          } else if (line.includes('Unit Price')) {
            currentItem.UnitPrice = extractValue(line);
          } else if (line.includes('Amount')) {
            currentItem.Amount = extractValue(line);
          }
        }
      }
    }

    if (currentItem) {
      jsonData.Items.push(currentItem);
    }

    return jsonData;
  };

  // Convert human-readable Check back to JSON
  const checkToJson = (text) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const jsonData = {
      DocumentType: 'check',
      CheckNumber: null,
      Date: null,
      PayeeName: null,
      Amount: null,
      AmountInWords: null,
      Memo: null,
      BankName: null,
      RoutingNumber: null,
      AccountNumber: null,
      PayerName: null,
      PayerAddress: null
    };

    for (let line of lines) {
      if (line.includes('═') || line.includes('CHECK INFORMATION') || 
          line.includes('PAYER INFORMATION') || line.includes('BANKING INFORMATION')) {
        continue;
      }

      if (line.includes('Check Number')) {
        jsonData.CheckNumber = extractValue(line);
      } else if (line.includes('Date')) {
        jsonData.Date = extractValue(line);
      } else if (line.includes('Payee Name')) {
        jsonData.PayeeName = extractValue(line);
      } else if (line.includes('Amount in Words')) {
        jsonData.AmountInWords = extractValue(line);
      } else if (line.includes('Amount')) {
        jsonData.Amount = extractValue(line);
      } else if (line.includes('Memo')) {
        jsonData.Memo = extractValue(line);
      } else if (line.includes('Payer Name')) {
        jsonData.PayerName = extractValue(line);
      } else if (line.includes('Payer Address')) {
        jsonData.PayerAddress = extractValue(line);
      } else if (line.includes('Bank Name')) {
        jsonData.BankName = extractValue(line);
      } else if (line.includes('Routing Number')) {
        jsonData.RoutingNumber = extractValue(line);
      } else if (line.includes('Account Number')) {
        jsonData.AccountNumber = extractValue(line);
      }
    }

    return jsonData;
  };

  // Main conversion function back to JSON
  const humanReadableToJson = (text) => {
    try {
      if (text.includes('CHECK INFORMATION')) {
        return checkToJson(text);
      } else {
        return invoiceToJson(text);
      }
    } catch (err) {
      console.error('Error converting to JSON:', err);
      throw new Error('Failed to parse document data');
    }
  };

  const extractValue = (line) => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const value = parts.slice(1).join(':').trim();
      return value === 'N/A' ? null : value;
    }
    return null;
  };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setUploadSuccess(false);
    setUploadError(null);
    setDocumentType(null);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    await uploadToBackend(file);
  };

  const uploadToBackend = async (file) => {
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload-invoice/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process document');
      }

      const data = await response.json();
      setDocumentType(data.DocumentType);
      const humanReadable = jsonToHumanReadable(data);
      setExtractedData(humanReadable);
    } catch (err) {
      setError(err.message);
      console.error('Error uploading document:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = (event) => {
    setExtractedData(event.target.value);
  };

  const handleUpload = async () => {
    if (!extractedData) {
      setUploadError('No data to upload');
      return;
    }

    setIsUploadingToERP(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const jsonData = humanReadableToJson(extractedData);

      const ERP_ENDPOINT = 'https://wh812a8d9aa97f6ecb41.free.beeceptor.com';
      
      const response = await fetch(ERP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jsonData),
      });

      if (!response.ok) {
        throw new Error('Failed to upload to ERP system');
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      console.log('Sent JSON data:', jsonData);
      setUploadSuccess(true);
      
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (err) {
      setUploadError(err.message);
      console.error('Error uploading to ERP:', err);
      
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setIsUploadingToERP(false);
    }
  };

  const getDocumentTypeLabel = () => {
    if (!documentType) return 'Document';
    return documentType === 'check' ? 'Check' : 'Invoice';
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Invoice & Check Data Extractor</h1>
      </header>

      <div style={styles.mainContent}>
        <div style={styles.leftPanel}>
          <div style={styles.uploadSection}>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              style={styles.fileInput}
              id="fileInput"
            />
            <label htmlFor="fileInput" style={styles.uploadButton}>
              Choose Invoice or Check File
            </label>
            {selectedFile && (
              <p style={styles.fileName}>{selectedFile.name}</p>
            )}
            {documentType && (
              <div style={documentType === 'check' ? styles.checkBadge : styles.invoiceBadge}>
                {documentType === 'check' ? 'Check Detected' : 'Invoice Detected'}
              </div>
            )}
          </div>

          <div style={styles.previewSection}>
            <h2 style={styles.sectionTitle}>{getDocumentTypeLabel()} Preview</h2>
            {isLoading && (
              <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>Processing document...</p>
              </div>
            )}
            {error && (
              <div style={styles.errorBox}>
                <p>Error: {error}</p>
              </div>
            )}
            {previewUrl && !isLoading && (
              <div style={styles.previewContainer}>
                {selectedFile?.type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    style={styles.pdfPreview}
                    title="Document Preview"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Document Preview"
                    style={styles.imagePreview}
                  />
                )}
              </div>
            )}
            {!previewUrl && !isLoading && (
              <div style={styles.emptyPreview}>
                <p>No document selected</p>
              </div>
            )}
          </div>
        </div>

        <div style={styles.rightPanel}>
          <h2 style={styles.sectionTitle}>Extracted Data</h2>
          <textarea
            value={extractedData}
            onChange={handleDataChange}
            placeholder="Extracted document data will appear here..."
            style={styles.dataTextarea}
          />
          {isUploadingToERP && (
            <div style={styles.uploadingBox}>
              <div style={styles.smallSpinner}></div>
              <p>Uploading to ERP system...</p>
            </div>
          )}
          {uploadSuccess && (
            <div style={styles.successBox}>
              <p>Successfully uploaded to ERP system</p>
            </div>
          )}
          {uploadError && (
            <div style={styles.uploadErrorBox}>
              <p>{uploadError}</p>
            </div>
          )}
          <button 
            onClick={handleUpload} 
            style={styles.uploadDataButton}
            disabled={isUploadingToERP || !extractedData}
          >
            Upload to ERP
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2c3e50',
    color: 'white',
    padding: '20px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '600',
  },
  mainContent: {
    display: 'flex',
    gap: '20px',
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
    minHeight: 'calc(100vh - 100px)',
  },
  leftPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  uploadSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  fileInput: {
    display: 'none',
  },
  uploadButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#3498db',
    color: 'white',
    borderRadius: '16px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    transition: 'background-color 0.3s',
  },
  fileName: {
    marginTop: '10px',
    color: '#555',
    fontSize: '14px',
  },
  invoiceBadge: {
    marginTop: '10px',
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#4F46E5',
    color: 'white',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
  },
  checkBadge: {
    marginTop: '10px',
    display: 'inline-block',
    padding: '8px 16px',
    backgroundColor: '#EA580C',
    color: 'white',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
  },
  previewSection: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    fontSize: '20px',
    color: '#2c3e50',
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'auto',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
  },
  pdfPreview: {
    width: '100%',
    height: '600px',
    border: 'none',
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '600px',
    objectFit: 'contain',
  },
  emptyPreview: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: '2px dashed #ddd',
    borderRadius: '4px',
    color: '#999',
    fontSize: '16px',
  },
  loadingContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #3498db',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  errorBox: {
    padding: '15px',
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '4px',
    color: '#c33',
  },
  uploadingBox: {
    padding: '15px',
    backgroundColor: '#e3f2fd',
    border: '1px solid #90caf9',
    borderRadius: '4px',
    color: '#1976d2',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  successBox: {
    padding: '15px',
    backgroundColor: '#e8f5e9',
    border: '1px solid #a5d6a7',
    borderRadius: '4px',
    color: '#2e7d32',
    textAlign: 'center',
  },
  uploadErrorBox: {
    padding: '15px',
    backgroundColor: '#fee',
    border: '1px solid #fcc',
    borderRadius: '4px',
    color: '#c33',
    textAlign: 'center',
  },
  smallSpinner: {
    width: '20px',
    height: '20px',
    border: '3px solid #bbdefb',
    borderTop: '3px solid #1976d2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  dataTextarea: {
    flex: 1,
    padding: '15px',
    fontSize: '14px',
    fontFamily: 'monospace',
    border: '1px solid #ddd',
    borderRadius: '6px',
    resize: 'none',
    backgroundColor: 'white',
    minHeight: '500px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    lineHeight: '1.6',
  },
  uploadDataButton: {
    padding: '12px 32px',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  button:hover:not(:disabled) {
    opacity: 0.9;
  }
  
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  label:hover {
    opacity: 0.9;
  }
`;
document.head.appendChild(styleSheet);

export default App;