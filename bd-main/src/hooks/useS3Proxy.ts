import { useState, useCallback, useEffect } from "react";
import { setS3Config } from "@/lib/api";

interface S3Config {
  bucket_name: string;
  endpoint_url: string;
}

const S3_CACHE_KEY = "s3_config_cache";

function loadCachedConfig(): S3Config | null {
  try {
    const cached = localStorage.getItem(S3_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function saveConfig(config: S3Config | null) {
  try {
    if (config) {
      localStorage.setItem(S3_CACHE_KEY, JSON.stringify(config));
    } else {
      localStorage.removeItem(S3_CACHE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Хук для управления S3-конфигурацией на клиенте.
 * Кэширует в localStorage и синхронизирует с api.ts.
 */
export function useS3Proxy() {
  const [config, setConfigState] = useState<S3Config | null>(loadCachedConfig);

  const updateConfig = useCallback((newConfig: S3Config | null) => {
    setConfigState(newConfig);
    saveConfig(newConfig);
    setS3Config(newConfig);
  }, []);

  useEffect(() => {
    if (config) {
      setS3Config(config);
    }
  }, [config]);

  return { config, updateConfig } as const;
}