// The rules files were written against one shared Supabase client. Each app (web panel,
// iPhone app) hands its own client over once at start-up with setSupabaseClient().
let current = null

export const setSupabaseClient = (client) => {
  current = client
}

export const supabase = new Proxy({}, {
  get(_target, prop) {
    if (!current) throw new Error('Supabase client is not set (call setSupabaseClient first)')
    const value = current[prop]
    return typeof value === 'function' ? value.bind(current) : value
  }
})
