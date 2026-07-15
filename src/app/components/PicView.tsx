import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Image as ImageIcon } from 'lucide-react';

// PIC bettet die State-V-Seite direkt als iFrame ein (keine externe Seite).
const PIC_URL = 'https://pic.statev.de/dashboard';

export default function PicView() {
  return (
    <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5 overflow-hidden">
      <CardHeader className="border-b border-primary/20">
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
            <ImageIcon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-black dark:text-white">PIC</span>
        </CardTitle>
        <CardDescription>Eingebettete PIC-Ansicht von State-V</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <iframe
          src={PIC_URL}
          title="PIC"
          className="w-full h-[calc(100vh-13rem)] min-h-[520px] border-0 bg-background"
          allow="clipboard-read; clipboard-write; camera; microphone; fullscreen"
        />
      </CardContent>
    </Card>
  );
}
