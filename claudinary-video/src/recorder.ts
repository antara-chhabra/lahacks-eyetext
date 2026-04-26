export class SessionRecorder {
  startTime = 0;
  private chunks: BlobPart[] = [];
  private mr: MediaRecorder | null = null;

  start(stream: MediaStream): void {
    this.chunks = [];
    this.startTime = Date.now();

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

    this.mr = new MediaRecorder(stream, { mimeType });
    this.mr.ondataavailable = e => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mr.start(1000);
  }

  stop(): Promise<Blob> {
    return new Promise(resolve => {
      if (!this.mr || this.mr.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: 'video/webm' }));
        return;
      }
      this.mr.onstop = () => resolve(new Blob(this.chunks, { type: 'video/webm' }));
      this.mr.stop();
    });
  }

  get isRecording(): boolean {
    return this.mr !== null && this.mr.state === 'recording';
  }
}
