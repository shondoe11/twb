import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

//& crowd-sourced remarks api - one wiki-style editable remark per location, backed by supabase 'community_remarks' table (see supabase/schema.sql)
//& GET returns the location's remark (or null), POST upserts it, an empty POST clears it

const MAX_REMARK_LENGTH = 280;

export async function GET(request: NextRequest) {
  const locationId = request.nextUrl.searchParams.get('locationId');

  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Remarks service unavailable' }, { status: 503 });
  }

  const { data, error } = await supabase
    .from('community_remarks')
    .select('content, updated_at')
    .eq('location_id', locationId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching remark:', error.message);
    return NextResponse.json({ error: 'Failed to fetch remark' }, { status: 500 });
  }

  return NextResponse.json(data ?? null);
}

export async function POST(request: NextRequest) {
  let body: { locationId?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const locationId = typeof body.locationId === 'string' ? body.locationId.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }
  if (content.length > MAX_REMARK_LENGTH) {
    return NextResponse.json({ error: `Remark must be ${MAX_REMARK_LENGTH} characters or less` }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Remarks service unavailable' }, { status: 503 });
  }

  //~ saving empty remark clears shared box fr this location
  if (!content) {
    const { error } = await supabase
      .from('community_remarks')
      .delete()
      .eq('location_id', locationId);

    if (error) {
      console.error('Error clearing remark:', error.message);
      return NextResponse.json({ error: 'Failed to clear remark' }, { status: 500 });
    }

    return NextResponse.json(null);
  }

  //~ upsert: one shared row per location, updated_at set explicitly since defaults only apply on insert
  const { data, error } = await supabase
    .from('community_remarks')
    .upsert({ location_id: locationId, content, updated_at: new Date().toISOString() })
    .select('content, updated_at')
    .single();

  if (error) {
    console.error('Error saving remark:', error.message);
    return NextResponse.json({ error: 'Failed to save remark' }, { status: 500 });
  }

  return NextResponse.json(data);
}
