import { createServer } from 'node:net';

// Use temporary ports so parallel runs and another local project cannot collide.
export async function testPorts() {
  const reservations = [createServer(), createServer()];
  try {
    await Promise.all(reservations.map(server => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    })));
    return reservations.map(server => server.address().port);
  } finally {
    await Promise.all(reservations.map(server => new Promise(resolve => server.close(resolve))));
  }
}
