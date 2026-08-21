//* unit tests fr the data processing & filtering logic
//~ these guard against regressions like the female-filter substring bug
import { describe, it, expect } from 'vitest';
import { geoJSONToLocations } from '../server/locationProcessor';
import { filterLocations } from '../client/dataService';
import { ToiletLocation, GeoJSONData } from '../shared/types';

//& fixture helpers
function makeSheetFeature(
  name: string,
  sourceTab: string,
  coords: [number, number],
  extraProps: Record<string, unknown> = {}
) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
    properties: {
      id: `sheets-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      address: `1 ${name} Road, Singapore 123456`,
      source: 'google-sheets',
      sourceTab,
      ...extraProps,
    },
  };
}

function makeGeoJSON(features: ReturnType<typeof makeSheetFeature>[]): GeoJSONData {
  return { type: 'FeatureCollection', features };
}

function makeLocation(overrides: Partial<ToiletLocation> = {}): ToiletLocation {
  return {
    id: 'loc-1',
    name: 'Test Toilet',
    lat: 1.35,
    lng: 103.82,
    hasBidet: true,
    lastUpdated: '2026-01-01',
    amenities: { wheelchairAccess: false, babyChanging: false, unisex: false, bidetInAllCubicles: false },
    ...overrides,
  };
}

describe('geoJSONToLocations', () => {
  it('returns empty array fr invalid input', () => {
    expect(geoJSONToLocations(undefined as unknown as GeoJSONData)).toEqual([]);
    expect(geoJSONToLocations({ type: 'FeatureCollection', features: null as unknown as GeoJSONData['features'] })).toEqual([]);
  });

  it('tags FEMALE TOILETS sheet features as Female (not Male substring match)', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([makeSheetFeature('Plaza Singapura', 'FEMALE TOILETS', [103.845, 1.3])])
    );

    expect(locations).toHaveLength(1);
    expect(locations[0].type).toBe('Female');
    expect(locations[0].gender).toBe('female');
    expect(locations[0].types).toContain('Female');
    expect(locations[0].types).not.toContain('Male');
  });

  it('tags MALE TOILETS sheet features as male', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([makeSheetFeature('Bugis Junction', 'MALE TOILETS', [103.855, 1.299])])
    );

    expect(locations[0].gender).toBe('male');
    expect(locations[0].types).toContain('Male');
  });

  it('tags hotel sheet features w Hotel type & any gender', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([makeSheetFeature('Hotel Mono', 'HOTEL ROOMS W BIDET', [103.84, 1.28])])
    );

    expect(locations[0].types).toContain('Hotel');
    expect(locations[0].gender).toBe('any');
  });

  it('falls back to Other whn no type info exists', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([makeSheetFeature('Mystery Loo', 'UNRELATED TAB', [103.8, 1.31])])
    );

    expect(locations[0].types).toEqual(['Other']);
  });

  it('dedupes features w identical name & coordinates', () => {
    const feature = makeSheetFeature('Duplicate Mall', 'MALE TOILETS', [103.83, 1.3]);
    const locations = geoJSONToLocations(makeGeoJSON([feature, { ...feature }]));

    expect(locations).toHaveLength(1);
  });

  it('merges male + female tab duplicates into one location w both type tags', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([
        makeSheetFeature('Dual Mall', 'MALE TOILETS', [103.83, 1.3], { remarks: 'level 1' }),
        makeSheetFeature('Dual Mall', 'FEMALE TOILETS', [103.83, 1.3], { remarks: 'unisex toilet at level 2' }),
      ])
    );

    expect(locations).toHaveLength(1);
    expect(locations[0].types).toContain('Male');
    expect(locations[0].types).toContain('Female');
    //~ 2nd row's remarks are kept & its amenity flags OR'd in
    expect(locations[0].sheetsRemarks).toContain('unisex toilet at level 2');
    expect(locations[0].amenities.unisex).toBe(true);
  });

  it('derives wheelchair access frm handicap keywords in remarks', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([
        makeSheetFeature('Handicap Mall', 'MALE TOILETS', [103.83, 1.3], { remarks: 'Handicap toilet only' }),
        makeSheetFeature('Wheelchair Cafe', 'MALE TOILETS', [103.84, 1.31], { remarks: 'wheelchair accessible entrance' }),
        makeSheetFeature('Plain Mall', 'MALE TOILETS', [103.85, 1.32], { remarks: 'level 2 near escalator' }),
      ])
    );

    expect(locations[0].amenities.wheelchairAccess).toBe(true);
    expect(locations[1].amenities.wheelchairAccess).toBe(true);
    expect(locations[2].amenities.wheelchairAccess).toBe(false);
  });

  it('does nt flag wheelchair access frm negative handicap mentions', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([
        makeSheetFeature('Unknown Mall', 'MALE TOILETS', [103.83, 1.3], { remarks: 'Male: yes<br>Handicap: unknown' }),
        makeSheetFeature('No Mall', 'MALE TOILETS', [103.84, 1.31], { remarks: 'Handicap: No' }),
        makeSheetFeature('Yes Mall', 'MALE TOILETS', [103.85, 1.32], { remarks: 'Handicap: Yes near entrance' }),
      ])
    );

    expect(locations[0].amenities.wheelchairAccess).toBe(false);
    expect(locations[1].amenities.wheelchairAccess).toBe(false);
    expect(locations[2].amenities.wheelchairAccess).toBe(true);
  });

  it('derives baby changing frm baby/nursing keywords in remarks', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([
        makeSheetFeature('Nursing Mall', 'FEMALE TOILETS', [103.83, 1.3], { remarks: 'found in nursing room' }),
        makeSheetFeature('Baby Plaza', 'FEMALE TOILETS', [103.84, 1.31], { remarks: 'baby changing station inside' }),
        makeSheetFeature('Plain Plaza', 'FEMALE TOILETS', [103.85, 1.32], { remarks: 'unisex toilet' }),
      ])
    );

    expect(locations[0].amenities.babyChanging).toBe(true);
    expect(locations[1].amenities.babyChanging).toBe(true);
    expect(locations[2].amenities.babyChanging).toBe(false);
  });

  it('derives unisex & bidet-in-all-cubicles frm remarks keywords', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([
        makeSheetFeature('Unisex Cafe', 'MALE TOILETS', [103.83, 1.3], { remarks: 'Unisex toilet!' }),
        makeSheetFeature('Cubicle Hub', 'MALE TOILETS', [103.84, 1.31], { remarks: 'all cubicles have bidet!' }),
        makeSheetFeature('Toilets Galore', 'MALE TOILETS', [103.85, 1.32], { remarks: 'all toilets got bidet' }),
      ])
    );

    expect(locations[0].amenities.unisex).toBe(true);
    expect(locations[0].amenities.bidetInAllCubicles).toBe(false);
    expect(locations[1].amenities.bidetInAllCubicles).toBe(true);
    expect(locations[2].amenities.bidetInAllCubicles).toBe(true);
  });

  it('derives amenities frm maps description text too', () => {
    const locations = geoJSONToLocations(
      makeGeoJSON([
        makeSheetFeature('Maps Spot', 'MALE TOILETS', [103.83, 1.3], {
          source: 'google-maps',
          address: '',
          description: 'bidet at handicap toilet',
        }),
      ])
    );

    expect(locations[0].amenities.wheelchairAccess).toBe(true);
  });
});

describe('filterLocations', () => {
  const locations: ToiletLocation[] = [
    makeLocation({ id: '1', name: 'North Female', region: 'North', type: 'Female', types: ['Female'] }),
    makeLocation({ id: '2', name: 'Central Male', region: 'Central', type: 'Male', types: ['Male'] }),
    makeLocation({
      id: '3',
      name: 'East Hotel',
      region: 'East',
      type: 'Hotel',
      types: ['Hotel'],
      hasBidet: false,
      amenities: { wheelchairAccess: true, babyChanging: false, unisex: true, bidetInAllCubicles: false },
    }),
  ];

  it('returns all locations whn no filters set', () => {
    expect(filterLocations(locations, {})).toHaveLength(3);
  });

  it('filters by region', () => {
    const result = filterLocations(locations, { region: 'North' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by type via types array', () => {
    const result = filterLocations(locations, { type: 'Female' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches type against single type property whn types arr missing', () => {
    const noArray = [makeLocation({ id: '4', type: 'Female', types: undefined })];
    expect(filterLocations(noArray, { type: 'Female' })).toHaveLength(1);
  });

  it('filters by amenities', () => {
    const wheelchair = filterLocations(locations, { amenities: { wheelchairAccess: true } });
    expect(wheelchair).toHaveLength(1);
    expect(wheelchair[0].id).toBe('3');

    const unisex = filterLocations(locations, { amenities: { unisex: true } });
    expect(unisex.map(l => l.id)).toEqual(['3']);
  });
});
