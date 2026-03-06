import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Supabase 설정이 없으면 null 반환 (로컬 테스트용)
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export interface Scenario {
  id?: number;
  korean: string;
  japanese: string;
  tokens: any;
  level: number;
  category: string;
}

export const scenarioService = {
  async getScenarios(): Promise<Scenario[]> {
    try {
      if (!supabase) {
        console.warn("Supabase credentials missing. Using local API.");
        const res = await fetch('/api/scenarios');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }

      const { data, error } = await supabase
        .from('scenarios')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error in getScenarios:", error);
      return [];
    }
  },

  async addScenario(scenario: Omit<Scenario, 'id'>) {
    try {
      if (!supabase) {
        const res = await fetch('/api/scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scenario)
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      }

      const { data, error } = await supabase
        .from('scenarios')
        .insert([scenario])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error in addScenario:", error);
      throw error;
    }
  },

  async searchScenario(korean: string): Promise<Scenario | null> {
    if (!supabase) {
      const res = await fetch(`/api/scenarios/search?q=${encodeURIComponent(korean)}`);
      if (!res.ok) return null;
      return res.json();
    }

    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('korean', korean)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getScenarioById(id: string | number): Promise<Scenario | null> {
    if (!supabase) {
      const res = await fetch(`/api/scenarios/${id}`);
      if (!res.ok) return null;
      return res.json();
    }

    const { data, error } = await supabase
      .from('scenarios')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
};
