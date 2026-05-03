import { SiGoogle, SiMeta, SiAlibabacloud, SiOpenai, SiNvidia, SiAnthropic } from 'react-icons/si';
import type { IconType } from 'react-icons';

// Maps `Model.id` → { icon, brand color hex (provider's official-ish accent) }
const MODEL_ICON_MAP: Record<string, { Icon: IconType; color: string; provider: string }> = {
  gemma:    { Icon: SiGoogle,        color: '#4285F4', provider: 'Google' },
  llama:    { Icon: SiMeta,          color: '#0866FF', provider: 'Meta' },
  qwen:     { Icon: SiAlibabacloud,  color: '#FF6A00', provider: 'Alibaba' },
  'gpt-oss':{ Icon: SiOpenai,        color: '#10A37F', provider: 'OpenAI' },
  nemotron: { Icon: SiNvidia,        color: '#76B900', provider: 'NVIDIA' },
  claude:   { Icon: SiAnthropic,     color: '#D97757', provider: 'Anthropic' },
};

export function getModelIcon(modelId: string) {
  return MODEL_ICON_MAP[modelId];
}
