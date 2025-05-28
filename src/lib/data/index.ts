//* main export fr data module
//~ client-side apps shld import frm data/client
//~ server-side code shld import frm data/server
//~ types r avail frm data/shared

export * from './shared';
export * from './client';

//& re-export only whats needed fr most common use cases
export { fetchLocations, filterLocations, sortLocationsByDistance } from './client/dataService';
