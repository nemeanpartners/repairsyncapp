export const printLabel = (ticket: any, customer: any, copies: number = 1) => {
  const printWindow = window.open('', '_blank', 'width=600,height=400');
  if (!printWindow) return;

  const labelHtml = `
       <div class="label-page">
         <div class="header">
           <span class="name" contenteditable="true" spellcheck="false">${customer?.firstname || ''} ${customer?.lastname || ''}</span>
           <span class="phone" contenteditable="true" spellcheck="false">${customer?.phone || customer?.mobile || ''}</span>
         </div>
         <div class="category" contenteditable="true" spellcheck="false">${ticket?.problem_type || 'DEVICE'}</div>
         <div class="model" contenteditable="true" spellcheck="false">${ticket?.device_model || ticket?.properties?.['Device Model'] || ticket?.subject || ''}</div>
         <div class="number-row">
           <div class="number" contenteditable="true" spellcheck="false">${ticket?.number || ''}</div>
         </div>
       </div>
  `;

  let labels = '';
  for (let i = 0; i < copies; i++) {
    labels += labelHtml;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Label</title>
      <style>
        @page {
          size: 87mm 36mm;
          margin: 0;
        }
        body {
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          margin: 0;
          color: #000;
          overflow: auto;
          background: #f4f4f5;
        }
        .labels-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .label-page {
          width: 87mm;
          height: 36mm;
          padding: 2mm 3mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          background: white;
          margin-bottom: 20px;
          page-break-after: always;
          border: 1px solid #e4e4e7;
          overflow: hidden;
        }
        .label-page:last-child {
          page-break-after: auto;
          margin-bottom: 0;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          font-weight: 700;
          gap: 4px;
        }
        .name {
          font-size: 18px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          outline: none;
        }
        .phone {
          font-size: 16px;
          white-space: nowrap;
          flex-shrink: 0;
          outline: none;
        }
        .category {
          font-size: 13px;
          text-transform: uppercase;
          color: #000;
          margin-top: 1px;
          margin-bottom: 1px;
          letter-spacing: 0.5px;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          outline: none;
        }
        .model {
          font-size: 13px;
          font-weight: 500;
          line-height: 1.2;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          flex: 1;
          outline: none;
        }
        .number-row {
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
        }
        .number {
          font-size: 34px;
          line-height: 0.9;
          font-weight: 900;
          outline: none;
        }
        [contenteditable="true"]:hover {
          background-color: #f4f4f5;
          border-radius: 2px;
        }
        [contenteditable="true"]:focus {
          background-color: #e0e7ff;
          border-radius: 2px;
        }
        .no-print {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 10px;
          background: #fafafa;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          border-bottom: 1px solid #e4e4e7;
          z-index: 1000;
          box-sizing: border-box;
        }
        .no-print button {
          padding: 8px 24px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
        }
        .no-print button:hover {
          background: #1d4ed8;
        }
        .info-msg {
          font-size: 11px;
          color: #71717a;
          margin-top: 6px;
        }
        
        @media print {
          .no-print { display: none !important; }
          body {
            background: transparent;
            margin: 0 !important;
            padding: 0 !important;
          }
          .labels-container {
            display: block;
          }
          .label-page {
            border: none;
            margin-bottom: 0;
          }
        }
        @media screen {
          body {
            padding-top: calc(70px + 2mm) !important;
            padding-bottom: 2mm !important;
          }
        }
      </style>
    </head>
    <body>
       <div class="no-print">
         <button onclick="window.print(); window.close();">Print Label(s)</button>
         <div class="info-msg">Click any text on the label to edit before printing.</div>
       </div>
       <div class="labels-container">
         ${labels}
       </div>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
};
