import { supabase } from '@/lib/supabase';

export interface AppSettings {
    id: number;
    upi_id: string | null;
    payee_name: string | null;
    payment_timing: 'while_ordering' | 'after_order' | 'dont_take_payment';
    charge_type: 'fixed' | 'percentage';
    charge_amount: number;
}

export const getSettings = async (): Promise<AppSettings | null> => {
    const { data, error } = await supabase
        .from('cafe_settings')
        .select('*')
        .eq('id', 1)
        .single();
    
    if (error) {
        console.error('Error fetching settings:', error);
        return null;
    }
    return data as AppSettings;
};

export const updateSettings = async (updates: Partial<AppSettings>): Promise<boolean> => {
    const { error } = await supabase
        .from('cafe_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', 1);

    if (error) {
        console.error('Error updating settings:', error);
        return false;
    }
    return true;
};
