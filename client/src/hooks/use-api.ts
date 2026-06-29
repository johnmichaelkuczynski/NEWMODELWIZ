import { useState } from 'react';

interface ApiRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

interface ApiResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Custom hook for making API requests with proper error handling
 */
export function useApi<T>() {
  const [result, setResult] = useState<ApiResult<T>>({
    data: null,
    error: null,
    isLoading: false
  });

  const request = async (options: ApiRequestOptions): Promise<T | null> => {
    setResult({
      data: null,
      error: null,
      isLoading: true
    });

    try {
      const requestOptions: RequestInit = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      };

      if (options.body && options.method !== 'GET') {
        requestOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(options.url, requestOptions);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      let data: T;
      
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Invalid JSON response from API');
      }

      setResult({
        data,
        error: null,
        isLoading: false
      });

      return data;
    } catch (error: any) {
      setResult({
        data: null,
        error: error.message || 'Unknown error',
        isLoading: false
      });
      return null;
    }
  };

  return {
    ...result,
    request
  };
}

/**
 * Simple function for one-off API requests
 */
export async function apiRequest<T>(options: ApiRequestOptions): Promise<T | null> {
  try {
    const requestOptions: RequestInit = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    if (options.body && options.method !== 'GET') {
      requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(options.url, requestOptions);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error('API request error:', error);
    throw error;
  }
}