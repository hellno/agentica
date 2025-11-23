import { logger, type IAgentRuntime, type Project, type ProjectAgent } from '@elizaos/core';
import starterPlugin from './plugin.ts';
import priceMonitorPlugin from './price-monitor.ts';
import tradeMonitorPlugin from './plugins/trade-monitor.ts';
import walletActionsPlugin from './plugins/wallet-actions.ts';
import { character } from './character.ts';

const initCharacter = ({ runtime }: { runtime: IAgentRuntime }) => {
  logger.info('Initializing character');
  logger.info({ name: character.name }, 'Name:');
};

export const projectAgent: ProjectAgent = {
  character,
  init: async (runtime: IAgentRuntime) => await initCharacter({ runtime }),
  plugins: [priceMonitorPlugin, tradeMonitorPlugin, walletActionsPlugin], // Custom plugins
};

const project: Project = {
  agents: [projectAgent],
};

export { character } from './character.ts';
export { default as priceMonitorPlugin } from './price-monitor.ts';
export { default as tradeMonitorPlugin } from './plugins/trade-monitor.ts';
export { default as walletActionsPlugin } from './plugins/wallet-actions.ts';

export default project;
