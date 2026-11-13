import { TRIconButton } from "@tinyrack/ui/components/icon-button";
import { TRText } from "@tinyrack/ui/components/text";
import { Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "~/lib/i18n";
import type { Audio } from "~/lib/types";

const COMMONS = "https://upload.wikimedia.org/wikipedia/commons/";

/** Plays a Wikimedia Commons recording. The audio file is fetched only when pressed. */
export function AudioButton({ audio }: { audio: Audio }) {
  const t = useT();
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    ref.current ??= new Audio(COMMONS + audio.mp3);
    const a = ref.current;
    a.currentTime = 0;
    a.onended = () => setPlaying(false);
    a.onerror = () => setPlaying(false);
    setPlaying(true);
    void a.play().catch(() => setPlaying(false));
  };
  return (
    <TRText as="span" className="inline-flex items-center gap-tinyrack-2xs">
      {audio.tag && (
        <TRText variant="caption" color="muted">
          {audio.tag}
        </TRText>
      )}
      <TRIconButton
        appearance="ghost"
        uiSize="sm"
        aria-label={audio.tag ? t.play(audio.tag) : t.playGeneric}
        aria-pressed={playing}
        onClick={play}
      >
        <Volume2 aria-hidden="true" size={16} />
      </TRIconButton>
    </TRText>
  );
}
