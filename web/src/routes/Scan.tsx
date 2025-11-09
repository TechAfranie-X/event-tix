import { useEffect, useState, useRef } from 'react';
import { getJson, postJson } from '../lib/api';
import Toast from '../components/Toast';

interface VerifyResult {
  valid: boolean;
  status: string | null;
  order_id: number | null;
  event_id: number | null;
  ticket_type: string | null;
}

interface CheckinResult {
  ok: boolean;
  previous_status: string | null;
  new_status: string | null;
}

export default function Scan() {
  const [scannedToken, setScannedToken] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    // Check if camera is available
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setCameraAvailable(true);
    }
  }, []);

  const handleManualInput = async () => {
    if (!scannedToken.trim()) {
      setError('Please enter a QR token');
      return;
    }

    await verifyToken(scannedToken.trim());
  };

  const verifyToken = async (token: string) => {
    setError(null);
    setVerifyResult(null);
    setCheckinResult(null);

    try {
      const result = await getJson<VerifyResult>(`/api/tickets/verify/${token}`);
      setVerifyResult(result);
      if (!result.valid) {
        setError('Invalid or expired ticket');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify ticket');
      setVerifyResult(null);
    }
  };

  const handleCheckin = async () => {
    if (!scannedToken.trim() || !verifyResult?.valid) {
      return;
    }

    setCheckingIn(true);
    setError(null);

    try {
      const result = await postJson<CheckinResult>(`/api/tickets/checkin/${scannedToken.trim()}`, {});
      setCheckinResult(result);
      if (result.ok) {
        setToast({
          message: 'Ticket checked in successfully!',
          type: 'success'
        });
        // Re-verify to get updated status
        await verifyToken(scannedToken.trim());
      } else {
        setError('Check-in failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in ticket');
    } finally {
      setCheckingIn(false);
    }
  };

  const startCameraScan = async () => {
    if (!cameraAvailable) {
      setError('Camera not available');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setScanning(true);
      }

      // Try to use @zxing/browser if available, otherwise fall back to manual input
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const codeReader = new BrowserQRCodeReader();
        
        codeReader.decodeFromVideoDevice(undefined, videoRef.current!, (result, error) => {
          if (result) {
            const token = result.getText();
            setScannedToken(token);
            verifyToken(token);
            stopCameraScan();
          }
          if (error && error.name !== 'NotFoundException') {
            console.error('QR scan error:', error);
          }
        });
      } catch (importError) {
        // @zxing/browser not available, use manual input only
        console.log('QR scanner library not available, using manual input');
        setError('Camera scanning requires @zxing/browser library. Please enter QR token manually.');
      }
    } catch (err) {
      setError('Failed to access camera');
      setCameraAvailable(false);
    }
  };

  const stopCameraScan = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  return (
    <div className="container">
      <h1>QR Ticket Scanner</h1>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {error && (
        <div className="card" style={{ background: '#fee', color: '#c33', marginBottom: '2rem' }}>
          {error}
        </div>
      )}

      <div className="card">
        <h2>Scan or Enter QR Token</h2>
        
        {cameraAvailable && (
          <div style={{ marginBottom: '1rem' }}>
            {!scanning ? (
              <button
                className="btn btn-primary"
                onClick={startCameraScan}
              >
                📷 Start Camera Scan
              </button>
            ) : (
              <div>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', maxWidth: '500px', marginBottom: '1rem' }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={stopCameraScan}
                >
                  Stop Camera
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '1rem' }}>
          <label htmlFor="qr-token" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
            Or enter QR token manually:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="qr-token"
              type="text"
              placeholder="Enter QR token"
              value={scannedToken}
              onChange={(e) => setScannedToken(e.target.value)}
              style={{ flex: 1, padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleManualInput();
                }
              }}
            />
            <button
              className="btn btn-primary"
              onClick={handleManualInput}
            >
              Verify
            </button>
          </div>
        </div>
      </div>

      {verifyResult && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2>Verification Result</h2>
          {verifyResult.valid ? (
            <div>
              <div style={{ padding: '1rem', background: '#d4edda', borderRadius: '4px', marginBottom: '1rem' }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#155724' }}>✓ Valid Ticket</p>
                <p><strong>Status:</strong> {verifyResult.status}</p>
                {verifyResult.event_id && <p><strong>Event ID:</strong> {verifyResult.event_id}</p>}
                {verifyResult.ticket_type && <p><strong>Ticket Type:</strong> {verifyResult.ticket_type}</p>}
                {verifyResult.order_id && <p><strong>Order ID:</strong> {verifyResult.order_id}</p>}
              </div>
              
              {verifyResult.status === 'issued' && (
                <button
                  className="btn btn-primary"
                  onClick={handleCheckin}
                  disabled={checkingIn}
                >
                  {checkingIn ? 'Checking in...' : 'Check In'}
                </button>
              )}
              
              {verifyResult.status === 'checked_in' && (
                <p style={{ color: '#28a745', fontWeight: 'bold' }}>✓ Already checked in</p>
              )}
            </div>
          ) : (
            <div style={{ padding: '1rem', background: '#f8d7da', borderRadius: '4px' }}>
              <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#721c24' }}>✗ Invalid Ticket</p>
              {verifyResult.status && <p>Status: {verifyResult.status}</p>}
            </div>
          )}
        </div>
      )}

      {checkinResult && (
        <div className="card" style={{ marginTop: '1rem' }}>
          {checkinResult.ok ? (
            <div style={{ padding: '1rem', background: '#d4edda', borderRadius: '4px' }}>
              <p style={{ fontWeight: 'bold', color: '#155724' }}>
                ✓ Check-in successful!
              </p>
              <p>
                {checkinResult.previous_status} → {checkinResult.new_status}
              </p>
            </div>
          ) : (
            <div style={{ padding: '1rem', background: '#f8d7da', borderRadius: '4px' }}>
              <p style={{ fontWeight: 'bold', color: '#721c24' }}>
                ✗ Check-in failed
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

