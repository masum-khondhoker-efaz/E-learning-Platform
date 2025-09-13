import { Server } from 'http';
import app from './app';
import seedSuperAdmin from './app/DB';
import config from './config';
import { setupWebSocket } from './app/utils/websocket';
import { setupSocketIO } from './app/utils/socketio';

const port = config.port || 5000;

async function main() {
  const server: Server = app.listen(port, () => {
    console.log('Sever is running on port ', port);
    seedSuperAdmin();
  });

  // setupWebSocket(server);
  setupSocketIO(server);


  const exitHandler = () => {
    if (server) {
      server.close(() => {
        console.info('Server closed!');
      });
    }
    process.exit(1);
  };

  process.on('uncaughtException', error => {
    console.log(error);
    exitHandler();
  });

  process.on('unhandledRejection', error => {
    console.log(error);
    exitHandler();
  });
}

main();
