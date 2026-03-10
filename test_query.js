const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://nfywqfdifxtkjcqkbsgv.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5meXdxZmRpZnh0a2pjcWtic2d2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjE5MjcsImV4cCI6MjA4ODE5NzkyN30.YkpEBU73Q90i-x3M7Ifj97yhfVJFsUEhpKe0lCp25Fw');
async function test() {
    const { data, error } = await supabase
        .from('tables')
        .select('*, sessions(id, customer_name, customer_phone, status, orders(id, total_amount, status))')
        .order('table_number');
    console.log('Error:', JSON.stringify(error, null, 2));
    console.log('Data:', data);
}
test();
