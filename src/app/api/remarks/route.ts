import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { readCombinedGeoJSON } from '@/lib/data/server/dataFetchers';
import { geoJSONToLocations } from '@/lib/data/server/locationProcessor';
import { ToiletLocation } from '@/lib/data/shared/types';

//& crowd-sourced remarks api - one wiki-style editable remark per location, backed by supabase 'community_remarks' table (see supabase/schema.sql)
//& GET returns the location's remark (or null), POST upserts it, an empty POST clears it

const MAX_REMARK_LENGTH = 280;

//& lightweight per-instance rate limiter fr writes - zero-cost abuse dampener note: state is per serverless instance so it's nt a hard guarantee, but it stops casual spam scripts
const RATE_LIMIT_MAX_WRITES = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const writeLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (writeLog.get(ip) ?? []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_WRITES) {
    writeLog.set(ip, recent);
    return true;
  }
  recent.push(now);
  writeLog.set(ip, recent);
  //~ evict stale entries so the map never grows unbounded
  if (writeLog.size > 1000) {
    for (const [key, times] of writeLog) {
      if (times.every(t => now - t >= RATE_LIMIT_WINDOW_MS)) writeLog.delete(key);
    }
  }
  return false;
}

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
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
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
