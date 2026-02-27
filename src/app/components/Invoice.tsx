import React, { useRef } from 'react';
import html2canvas from 'html2canvas';
import headerImage from 'figma:asset/d2fc918383f600f56ee5a43c3dc5c6e2fa70fbf3.png';

const Invoice = ({ data }: { data: any }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!data) {
    return (
      <div className="text-center text-red-600 p-10">
        <h2 className="text-xl font-bold">Fehler: Keine Daten vorhanden</h2>
        <p className="text-sm">Bitte stelle sicher, dass das <code>data</code>-Objekt korrekt übergeben wird.</p>
      </div>
    );
  }

  const formatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD'
  });

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('de-DE');
  };

  // Header-Bild Pfad (vom Import)
  // const headerImage = "/header_invoice.svg";
  
  const {
    customerName,
    customerEmail,
    customerPhone,
    orderNumber,
    deliveryDate,
    reference,
    paymentNote,
    vban,
    items = []
  } = data;

  // SCHMELZDEPOT: Immer +5% Steuer
  const taxPercent = 5;
  const taxMode = 'plus';

  const calcSubtotal = () => {
    return items.reduce((sum: number, item: any) => {
      const price = item.price || 0;
      const qty = item.qty || 1;
      const disc = item.disc || 0;
      return sum + price * qty * (1 - disc / 100);
    }, 0);
  };

  const sub = calcSubtotal();
  const fee = sub * (taxPercent / 100);
  const net = taxMode === 'plus' ? sub + fee : Math.max(0, sub - fee);

  const handleExport = async () => {
    if (!invoiceRef.current) {
      console.error('❌ Invoice reference not found');
      return;
    }

    // Check if html2canvas is available
    if (!html2canvas) {
      console.error('❌ html2canvas not loaded');
      alert('html2canvas wird geladen... Bitte versuchen Sie es in wenigen Sekunden erneut.');
      return;
    }

    try {
      console.log('🚀 Starting PNG export (949×1177px @ 96 DPI, 32-bit)...');
      
      // Get the wrapper and invoice element
      const wrapper = invoiceRef.current.parentElement;
      const originalTransform = wrapper ? wrapper.style.transform : null;
      
      // Temporarily remove transform for export
      if (wrapper) {
        wrapper.style.transform = 'none';
      }
      
      // Fixed width, dynamic height to prevent footer cutoff
      const EXPORT_WIDTH = 949;
      const actualHeight = invoiceRef.current.scrollHeight;
      const EXPORT_HEIGHT = actualHeight; // Exakte Höhe ohne Padding
      
      console.log(`📏 Export dimensions: ${EXPORT_WIDTH}×${EXPORT_HEIGHT}px @ 96 DPI (content height: ${actualHeight}px)`);
      
      // Create canvas with exact dimensions (scale 1 for 96 DPI, 1:1 pixel mapping)
      const canvas = await html2canvas(invoiceRef.current, {
        backgroundColor: '#ffffff',
        scale: 1, // 1:1 pixel mapping for exact 96 DPI
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        windowWidth: EXPORT_WIDTH,
        windowHeight: EXPORT_HEIGHT,
        useCORS: true,
        allowTaint: false,
        logging: false,
        removeContainer: true,
        imageTimeout: 15000,
        ignoreElements: (element) => {
          const tagName = element.tagName.toLowerCase();
          return tagName === 'style' || (tagName === 'link' && element.getAttribute('rel') === 'stylesheet');
        },
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.querySelector('[data-invoice-export]') as HTMLElement;
          if (clonedElement) {
            clonedElement.style.fontFamily = 'Arial, sans-serif';
            clonedElement.style.width = `${EXPORT_WIDTH}px`;
            clonedElement.style.minHeight = 'auto';
            clonedElement.style.height = 'auto';
            
            // WICHTIG: Border und Shadow für Export entfernen - nur weißer Hintergrund
            clonedElement.style.border = 'none';
            clonedElement.style.boxShadow = 'none';
            clonedElement.style.backgroundColor = '#ffffff';
            
            // KEIN Padding-Bottom - Footer soll direkt am Ende sein
            clonedElement.style.paddingBottom = '0';
            
            // Remove any zoom or transform
            const clonedWrapper = clonedElement.parentElement;
            if (clonedWrapper) {
              clonedWrapper.style.zoom = '1';
              clonedWrapper.style.transform = 'none';
              clonedWrapper.style.width = `${EXPORT_WIDTH}px`;
              clonedWrapper.style.height = `${EXPORT_HEIGHT}px`;
              clonedWrapper.style.backgroundColor = '#ffffff';
            }
            
            // Force simple colors for consistent rendering
            const allElements = clonedElement.querySelectorAll('*');
            allElements.forEach(el => {
              if (el instanceof HTMLElement) {
                if (el.style.backgroundColor === 'rgb(255, 128, 0)' || el.style.backgroundColor === '#ff8000') {
                  el.style.backgroundColor = '#ff8000';
                }
                if (el.style.color === 'rgb(255, 255, 255)' || el.style.color === '#ffffff') {
                  el.style.color = '#ffffff';
                }
              }
            });
          }
        }
      });
      
      // Restore original transform
      if (wrapper && originalTransform) {
        wrapper.style.transform = originalTransform;
      }
      
      console.log(`📊 Canvas generated: ${canvas.width}×${canvas.height}px`);
      
      // Verify exact dimensions
      if (canvas.width !== EXPORT_WIDTH || canvas.height !== EXPORT_HEIGHT) {
        console.warn(`⚠️ Canvas size mismatch! Expected ${EXPORT_WIDTH}×${EXPORT_HEIGHT}, got ${canvas.width}×${canvas.height}`);
      }
      
      const link = document.createElement('a');
      link.download = `SCHMELZDEPOT_Rechnung_${orderNumber || 'INVOICE'}.png`;
      // Export as 32-bit PNG (RGBA) with maximum quality
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
      
      console.log(`✅ PNG exported successfully`);
      alert('✅ PNG erfolgreich exportiert!');
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert('❌ Export fehlgeschlagen: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const checkHtml2Canvas = () => {
    if (html2canvas) {
      alert('✅ html2canvas ist verfügbar und bereit!');
      console.log('✅ html2canvas status: Available');
    } else {
      alert('❌ html2canvas ist nicht verfügbar. Bitte warten Sie einen Moment und versuchen Sie es erneut.');
      console.log('❌ html2canvas status: Not available');
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-7xl mx-auto">
      <div className="flex gap-2 mb-4 mt-2 no-print">
        <button
          onClick={handleExport}
          className="px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg gpu-accelerate"
        >
          <span className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportieren als PNG (949×1177px)
          </span>
        </button>
        <button
          onClick={checkHtml2Canvas}
          className="px-4 py-2.5 bg-muted text-foreground text-sm rounded-lg hover:bg-muted/80 transition-all duration-200 border border-border"
        >
          Test html2canvas
        </button>
      </div>

      {/* Invoice preview container with scroll */}
      <div 
        className="no-print w-full"
        style={{ 
          maxHeight: 'calc(100vh - 180px)',
          overflow: 'auto',
          border: 'none',
          borderRadius: '0',
          backgroundColor: 'transparent',
          padding: '0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start'
        }}
      >
        {/* Scaled wrapper for compact display */}
        <div style={{ 
          transform: 'scale(0.48)',
          transformOrigin: 'top center',
          width: '949px'
        }}
        >
        <div 
          ref={invoiceRef} 
          data-invoice-export="true"
          style={{ 
            width: '949px',
            minHeight: 'auto',
            border: 'none',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#ffffff',
            fontSize: '16px',
            boxShadow: 'none',
            paddingBottom: '0'
          }}
        >
        {/* Header - SCHMELZDEPOT Banner */}
        <img 
          src={headerImage} 
          alt="SCHMELZDEPOT RECHNUNG" 
          style={{ 
            width: '100%', 
            height: 'auto',
            display: 'block',
            flexShrink: 0
          }}
        />

        {/* Customer Information Section */}
        <div style={{ 
          borderBottom: '2px solid #e5e7eb', 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr',
          flexShrink: 0 
        }}>
          {/* Left Column - Customer Details */}
          <div style={{ padding: '32px', borderRight: '2px solid #e5e7eb' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Kundenname</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{customerName}</div>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>E-Mail</div>
              <div style={{ fontSize: '18px', color: '#111827' }}>{customerEmail}</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Telefon</div>
              <div style={{ fontSize: '18px', color: '#111827' }}>{customerPhone}</div>
            </div>
          </div>

          {/* Right Column - Order Details */}
          <div style={{ padding: '32px' }}>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Bestellnummer</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827' }}>{orderNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>Lieferdatum</div>
              <div style={{ fontSize: '18px', color: '#111827' }}>
                {deliveryDate ? formatDate(deliveryDate) : '-'}
              </div>
            </div>
          </div>
        </div>

        {/* Items Table - Progressive Expansion */}
        <div style={{ 
          padding: '32px', 
          flex: 1,
          minHeight: '600px',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            marginBottom: '32px'
          }}>
            {/* Table Header - Orange */}
            <thead>
              <tr style={{ 
                backgroundColor: '#ff8000', 
                color: '#ffffff'
              }}>
                <th style={{ 
                  textAlign: 'left', 
                  padding: '16px 12px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}>ARTIKEL</th>
                <th style={{ 
                  textAlign: 'center', 
                  padding: '16px 12px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}>MENGE</th>
                <th style={{ 
                  textAlign: 'right', 
                  padding: '16px 12px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}>PREIS</th>
                <th style={{ 
                  textAlign: 'right', 
                  padding: '16px 12px',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}>GESAMT</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {items.map((item: any, index: number) => {
                const itemTotal = item.price * item.qty * (1 - (item.disc || 0) / 100);
                return (
                  <tr 
                    key={index} 
                    style={{ 
                      borderBottom: '1px solid #e5e7eb',
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb'
                    }}
                  >
                    <td style={{ 
                      padding: '14px 12px', 
                      fontSize: '16px',
                      color: '#111827'
                    }}>{item.name}</td>
                    <td style={{ 
                      padding: '14px 12px', 
                      textAlign: 'center',
                      fontSize: '16px',
                      color: '#111827'
                    }}>{item.qty}</td>
                    <td style={{ 
                      padding: '14px 12px', 
                      textAlign: 'right',
                      fontSize: '16px',
                      color: '#111827'
                    }}>{formatter.format(item.price)}</td>
                    <td style={{ 
                      padding: '14px 12px', 
                      textAlign: 'right',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#111827'
                    }}>{formatter.format(itemTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Summary Section */}
          <div style={{ 
            marginTop: 'auto',
            paddingTop: '24px',
            borderTop: '2px solid #e5e7eb'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '8px 0',
              fontSize: '16px'
            }}>
              <span style={{ color: '#6b7280' }}>Zwischensumme</span>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>{formatter.format(sub)}</span>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '8px 0',
              fontSize: '16px'
            }}>
              <span style={{ color: '#6b7280' }}>Steuer (+5%)</span>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>+{formatter.format(fee)}</span>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              padding: '8px 0',
              fontSize: '16px'
            }}>
              <span style={{ color: '#6b7280' }}>Gesamtsumme</span>
              <span style={{ fontWeight: 'bold', color: '#111827' }}>{formatter.format(net)}</span>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              paddingTop: '20px',
              marginTop: '20px',
              borderTop: '3px solid #111827',
              fontSize: '22px',
              fontWeight: 'bold'
            }}>
              <span style={{ color: '#111827' }}>Zahlungssumme</span>
              <span style={{ color: '#ff8000' }}>{formatter.format(sub)}</span>
            </div>
          </div>
        </div>

        {/* Footer - Orange with Payment Info */}
        <div 
          style={{ 
            backgroundColor: '#ff8000',
            color: '#ffffff',
            padding: '40px 32px 40px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            flexShrink: 0,
            marginTop: 'auto'
          }}
        >
          <p style={{ 
            fontSize: '14px', 
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            margin: '0',
            textTransform: 'uppercase'
          }}>
            LITTLE SEOUL WEST 121 · SA, LOS SANTOS · SCHMELZDEPOT@STATEV.DE
          </p>
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            gap: '20px'
          }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>
              Verwendungszweck: {reference || orderNumber}
            </span>
            <span style={{ 
              fontFamily: 'monospace', 
              fontSize: '22px', 
              fontWeight: 'bold',
              letterSpacing: '1px'
            }}>
              VBAN-409856
            </span>
          </div>
          
          <p style={{ 
            fontSize: '13px', 
            lineHeight: '1.5',
            opacity: 0.95,
            margin: '0',
            maxWidth: '100%'
          }}>
            Nach Eingang dieses Schreibens haben Sie 3 Tage Zeit die Rechnung zu begleichen. Bei nicht fristgerechter Zahlung behalten wir uns rechtliche Schritte sowie Verzugsgebühren von 200$ pro Tag vor.
          </p>
        </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
