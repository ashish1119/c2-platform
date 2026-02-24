import { useEffect, useState } from "react";

interface Alert {
  alert_id: string;
  event: string;
}

export default function AlertTable() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/alerts");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setAlerts(prev => [data, ...prev]);
    };

    return () => ws.close();
  }, []);

  return (
    <div>
      <h3>Real-Time Alerts</h3>
      <ul>
        {alerts.map((a, i) => (
          <li key={i}>{a.event} - {a.alert_id}</li>
        ))}
      </ul>
    </div>
  );
}