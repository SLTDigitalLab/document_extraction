// src/pages/InvoiceExtractor.jsx
import { useState } from 'react';
import './InvoiceExtractor.css';
//import '../styles/InvoiceExtractor.css';

function InvoiceExtractor() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extractedData, setExtractedData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Upload to backend automatically
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
        throw new Error('Failed to process invoice');
      }

      const data = await response.json();
      setExtractedData(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err.message);
      console.error('Error uploading invoice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDataChange = (event) => {
    setExtractedData(event.target.value);
  };

  const handleUpload = () => {
    // Empty function for future implementation
    console.log('Upload button clicked');
  };

  return (
    <div className="invoice-container">
      <header className="invoice-header">
        <h1 className="invoice-title">Invoice Data Extractor</h1>
      </header>

      <div className="invoice-main-content">
        {/* Left Side - Invoice Preview */}
        <div className="invoice-left-panel">
          <div className="invoice-upload-section">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="invoice-file-input"
              id="fileInput"
            />
            <label htmlFor="fileInput" className="invoice-upload-button">
              Choose Invoice File
            </label>
            {selectedFile && (
              <p className="invoice-file-name">{selectedFile.name}</p>
            )}
          </div>

          <div className="invoice-preview-section">
            <h2 className="invoice-section-title">Invoice Preview</h2>
            {isLoading && (
              <div className="invoice-loading-container">
                <div className="invoice-spinner"></div>
                <p>Processing invoice...</p>
              </div>
            )}
            {error && (
              <div className="invoice-error-box">
                <p>Error: {error}</p>
              </div>
            )}
            {previewUrl && !isLoading && (
              <div className="invoice-preview-container">
                {selectedFile?.type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="invoice-pdf-preview"
                    title="Invoice Preview"
                  />
                ) : (
                  <img
                    src={previewUrl}
                    alt="Invoice Preview"
                    className="invoice-image-preview"
                  />
                )}
              </div>
            )}
            {!previewUrl && !isLoading && (
              <div className="invoice-empty-preview">
                <p>No invoice selected</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Extracted Data */}
        <div className="invoice-right-panel">
          <h2 className="invoice-section-title">Extracted Data</h2>
          <textarea
            value={extractedData}
            onChange={handleDataChange}
            placeholder="Extracted invoice data will appear here..."
            className="invoice-data-textarea"
          />
          <button onClick={handleUpload} className="invoice-upload-data-button">
            Upload
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceExtractor;