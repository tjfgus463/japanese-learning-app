import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export interface Scenario {
  id?: number;
  korean: string;
  japanese: string;
  tokens: any;
  level: number;
  category: string;
}

class DatabaseService {
  private sqlite: any;
  private supabase: SupabaseClient | null = null;
  private useSupabase: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (SUPABASE_URL && SUPABASE_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      this.useSupabase = true;
      console.log("Using Supabase as database");
    } else {
      try {
        // Dynamic import to avoid issues in environments where better-sqlite3 isn't supported
        const Database = (await import("better-sqlite3")).default;
        this.sqlite = new Database("japanese_learning.db");
        this.initSqlite();
        console.log("Using local SQLite as database");
      } catch (err) {
        console.error("Failed to initialize SQLite:", err);
      }
    }
  }

  private initSqlite() {
    if (!this.sqlite) return;
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        korean TEXT NOT NULL,
        japanese TEXT NOT NULL,
        tokens TEXT NOT NULL,
        level INTEGER DEFAULT 1,
        category TEXT DEFAULT '일반'
      )
    `);
  }

  async getScenarios(): Promise<Scenario[]> {
    if (this.useSupabase && this.supabase) {
      const { data, error } = await this.supabase
        .from('scenarios')
        .select('*');
      if (error) throw error;
      return data || [];
    } else {
      const rows = this.sqlite.prepare("SELECT * FROM scenarios").all();
      return rows.map((r: any) => ({
        ...r,
        tokens: JSON.parse(r.tokens)
      }));
    }
  }

  async getScenarioByKorean(korean: string): Promise<Scenario | null> {
    if (this.useSupabase && this.supabase) {
      const { data, error } = await this.supabase
        .from('scenarios')
        .select('*')
        .eq('korean', korean)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } else {
      const row = this.sqlite.prepare("SELECT * FROM scenarios WHERE korean = ?").get(korean);
      if (!row) return null;
      return {
        ...row,
        tokens: JSON.parse(row.tokens)
      };
    }
  }

  async getScenarioById(id: string | number): Promise<Scenario | null> {
    if (this.useSupabase && this.supabase) {
      const { data, error } = await this.supabase
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } else {
      const row = this.sqlite.prepare("SELECT * FROM scenarios WHERE id = ?").get(id);
      if (!row) return null;
      return {
        ...row,
        tokens: JSON.parse(row.tokens)
      };
    }
  }

  async addScenario(scenario: Scenario): Promise<{ success: boolean; id?: number; message?: string }> {
    if (this.useSupabase && this.supabase) {
      // Check existing
      const existing = await this.getScenarioByKorean(scenario.korean);
      if (existing) {
        return { success: true, id: existing.id, message: "Already exists" };
      }

      const { data, error } = await this.supabase
        .from('scenarios')
        .insert([{
          korean: scenario.korean,
          japanese: scenario.japanese,
          tokens: scenario.tokens,
          level: scenario.level,
          category: scenario.category
        }])
        .select()
        .single();
      
      if (error) throw error;
      return { success: true, id: data.id };
    } else {
      const existing = this.sqlite.prepare("SELECT id FROM scenarios WHERE korean = ?").get(scenario.korean);
      if (existing) {
        return { success: true, id: existing.id, message: "Already exists" };
      }

      const insert = this.sqlite.prepare("INSERT INTO scenarios (korean, japanese, tokens, level, category) VALUES (?, ?, ?, ?, ?)");
      const result = insert.run(
        scenario.korean, 
        scenario.japanese, 
        JSON.stringify(scenario.tokens), 
        scenario.level || 1, 
        scenario.category || '일반'
      );
      return { success: true, id: Number(result.lastInsertRowid) };
    }
  }

  // Generic seed method for both SQLite and Supabase
  async seed(data: Scenario[]) {
    if (this.useSupabase && this.supabase) {
      const { count, error: countError } = await this.supabase
        .from('scenarios')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        console.error("Error checking Supabase count:", countError);
        return;
      }

      if (count === 0) {
        console.log("Seeding Supabase with initial data...");
        const { error: insertError } = await this.supabase
          .from('scenarios')
          .insert(data.map(d => ({
            korean: d.korean,
            japanese: d.japanese,
            tokens: d.tokens,
            level: d.level,
            category: d.category
          })));
        
        if (insertError) console.error("Error seeding Supabase:", insertError);
        else console.log("Supabase seeded successfully!");
      }
    } else if (this.sqlite) {
      const count = this.sqlite.prepare("SELECT count(*) as count FROM scenarios").get() as { count: number };
      if (count.count === 0) {
        console.log("Seeding SQLite with initial data...");
        const insert = this.sqlite.prepare("INSERT INTO scenarios (korean, japanese, tokens, level, category) VALUES (?, ?, ?, ?, ?)");
        data.forEach(d => {
          insert.run(d.korean, d.japanese, JSON.stringify(d.tokens), d.level, d.category);
        });
        console.log("SQLite seeded successfully!");
      }
    }
  }
}

export const dbService = new DatabaseService();
