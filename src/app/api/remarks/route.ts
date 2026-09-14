import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { createRateLimiter, clientIp } from '@/lib/rateLimit';
import { readCombinedGeoJSON } from '@/lib/data/server/dataFetchers';
import { geoJSONToLocations } from '@/lib/data/server/locationProcessor';
import { ToiletLocation } from '@/lib/data/shared/types';

//* crowd-sourced remarks api - 1 wiki-style editable remark per location, backed by supabase 'community_remarks' table (see supabase/schema.sql)
//& GET returns location's remark (or null), POST upserts it, empty POST clears it

const MAX_REMARK_LENGTH = 280;

//& lightweight per-instance rate limiter fr writes - zero-cost abuse dampener note: state is per serverless instance so it's nt hard guarantee, but it stops casual spam scripts
//~ impl lives in src/lib/rateLimit.ts so feedback api shares it
const isRateLimited = createRateLimiter(5, 60_000);

//& id -> location lookup built once per server instance - used to validate posted ids + stamp canonical name/address/region into supabase rows so dashboard data stays readable
let locationIndexPromise: Promise<Map<string, ToiletLocation>> | null = null;
function getLocationIndex(): Promise<Map<string, ToiletLocation>> {
  if (!locationIndexPromise) {
    locationIndexPromise = readCombinedGeoJSON().then(geoData => {
      const index = new Map<string, ToiletLocation>();
      geoJSONToLocations(geoData).forEach(loc => index.set(loc.id, loc));
      return index;
    });
  }
  return locationIndexPromise;
}

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
  //~ vercel sets x-forwarded-for to real client ip (first entry)
  if (isRateLimited(clientIp(request.headers))) {
    return NextResponse.json({ error: 'Too many edits - please wait a minute' }, { status: 429 });
  }

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

  //~ reject ids that don't belong to a real location - keeps junk rows out of table
  const location = (await getLocationIndex()).get(locationId);
  if (!location) {
    return NextResponse.json({ error: 'Unknown location' }, { status: 404 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Remarks service unavailable' }, { status: 503 });
  }

  //~ saving empty remark clears the shared box fr this location
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
  //~ name/address/region stamped frm canonical server data, never trusted frm the client
  const { data, error } = await supabase
    .from('community_remarks')
    .upsert({
      location_id: locationId,
      location_name: location.name,
      address: location.address ?? null,
      region: location.region ?? null,
      content,
      updated_at: new Date().toISOString(),
    })
    .select('content, updated_at')
    .single();

  if (error) {
    console.error('Error saving remark:', error.message);
    return NextResponse.json({ error: 'Failed to save remark' }, { status: 500 });
  }

  return NextResponse.json(data);
}
