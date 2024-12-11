type SettingMapItem = {
  model:
    | ((model: string) => string) // model may be modified to fit litellm's format
    | null // user input
    | { label: string; value: string }[]; // preset
  hasBaseUrl: boolean;
};

export const settingMap: Record<string, SettingMapItem> = {
  openai: {
    model: null,
    hasBaseUrl: false,
  },
  anthropic: {
    model: null,
    hasBaseUrl: false,
  },
  deepseek: {
    model: [{ label: 'DeepSeek Chat', value: 'deepseek/deepseek-chat' }],
    hasBaseUrl: false,
  },
  ollama: {
    model: (model) => `ollama/${model}`,
    hasBaseUrl: true,
  },
  openrouter: {
    model: (model) => `openrouter/${model}`,
    hasBaseUrl: false,
  },
  openai_compatible: {
    model: (model) => `openai/${model}`,
    hasBaseUrl: true,
  },
  gemini: {
    model: (model) => `gemini/${model}`,
    hasBaseUrl: false,
  },
};
