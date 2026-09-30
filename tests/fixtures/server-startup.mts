import { Server } from 'node:http';
import { CheckpointStore } from '../../packages/server/src/world/CheckpointStore.js';
import { PersistentMemoryManager } from '../../packages/server/src/memory/PersistentMemoryManager.js';

const mode = process.argv[2];
const waitForShutdown = async () => {
  console.log('STARTUP_BLOCKED');
  return new Promise<never>(() => {});
};
if (mode === 'memories') PersistentMemoryManager.prototype.loadAll = waitForShutdown;
if (mode === 'checkpoint') CheckpointStore.prototype.load = waitForShutdown;

const listen = Server.prototype.listen;
Server.prototype.listen = function (...args) {
  this.once('listening', () => console.log('STARTUP_LISTENING', JSON.stringify(this.address())));
  return Reflect.apply(listen, this, args);
};
await import('../../packages/server/src/index.js');
