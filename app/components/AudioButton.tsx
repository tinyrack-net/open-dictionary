import { TRBadge } from "@tinyrack/ui/components/badge";
import { TRIconButton } from "@tinyrack/ui/components/icon-button";
import { TRText } from "@tinyrack/ui/components/text";
import { Volume2 } from "lucide-react";
import { useRef, useState } from "react";
import { tagLabel, useT } from "~/lib/i18n";
import type { Audio } from "~/lib/types";

/** Plays a recording from its source URL. The file is fetched only when pressed. */
export function AudioButton({ audio }: { audio: Audio }) {
  const t = useT();
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const label = audio.tags?.map((tag) => tagLabel(t, tag)).join(", ");
  const play = () => {
    ref.current ??= new Audio(audio.url);
    const a = ref.current;
    a.currentTime = 0;
    a.onended = () => setPlaying(false);
    a.onerror = () => setPlaying(false);
    setPlaying(true);
    void a.play().catch(() => setPlaying(false));
  };
  return (
    <TRText as="span" className="inline-flex items-center gap-tinyrack-2xs">
      {label && <TRBadge title={audio.tags?.join(", ")}>{label}</TRBadge>}
      <TRIconButton appearance="ghost" uiSize="sm" aria-label={label ? t.play(label) : t.playGeneric} aria-pressed={playing} onClick={play}>
        <Volume2 aria-hidden="true" size={16} />
      </TRIconButton>
    </TRText>
  );
}
