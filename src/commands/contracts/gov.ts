import { MirrorGov } from '@mirror-protocol/mirror.js';
import * as _ from 'lodash';

import { Parse } from '../../util/parse-input';
import {
  createExecMenu,
  createQueryMenu,
  handleExecCommand,
  handleQueryCommand,
} from '../../util/contract-menu';

const exec = createExecMenu('gov', 'Mirror Gov contract functions');

const updateConfig = exec
  .command('update-config')
  .description(`Update Mirror Gov config`)
  .option('--owner <AccAddress>', 'New owner address')
  .option('--effective-delay <int>', 'New effective delay')
  .option('--expiration-period <int>', 'New expiration period')
  .option('--proposal-deposit <Uint128>', 'New min proposal deposit')
  .option('--quorum <dec>', 'New quorum %')
  .option('--threshold <dec>', 'New threshold %')
  .option('--voting-period <int>', 'New voting period (sec)')
  .action(async () => {
    await handleExecCommand(exec, async mirror =>
      mirror.gov.updateConfig({
        owner: Parse.accAddress(updateConfig.owner),
        effective_delay: Parse.int(updateConfig.effectiveDelay),
        expiration_period: Parse.int(updateConfig.expirationPeriod),
        proposal_deposit: updateConfig.proposalDeposit
          ? Parse.uint128(updateConfig.proposalDeposit).toString()
          : undefined,
        quorum: updateConfig.quorum
          ? Parse.dec(updateConfig.quorum).toFixed()
          : undefined,
        threshold: updateConfig.threshold
          ? Parse.dec(updateConfig.threshold).toFixed()
          : undefined,
        voting_period: Parse.int(updateConfig.votingPeriod),
      })
    );
  });

const castVote = exec
  .command('cast-vote <poll-id> <vote-option> <amount>')
  .description(`Vote in an active poll`, {
    'poll-id': '(int) Poll ID',
    'vote-option': `(string) 'yes' or 'no'`,
    amount: '(Uint128) amount of staked MIR voting power to allocate',
  })
  .action(async (pollId: string, voteOption: string, amount: string) => {
    if (voteOption !== 'yes' && voteOption !== 'no') {
      throw new Error(
        `invalid vote option '${voteOption}', MUST be 'yes' or 'no'`
      );
    }
    await handleExecCommand(exec, async mirror =>
      mirror.gov.castVote(Parse.int(pollId), voteOption, Parse.uint128(amount))
    );
  });

const createPoll = exec
  .command('create-poll')
  .description(`Create a new poll`)
  .requiredOption('--title <string>', '*Title of poll')
  .requiredOption('--desc <string>', '*Poll description')
  .requiredOption('--deposit <Uint128>', '*deposit amount of MIR tokens')
  .option('--link <url>', 'URL with more information')
  .option(
    '--execute-to <AccAddress>',
    'contract to execute on (specify message with --execute-msg)'
  )
  .option('--execute-msg <json>', 'message to execute')
  .action(async () => {
    let executeMsg: MirrorGov.ExecuteMsg;

    if (createPoll.executeTo || createPoll.executeMsg) {
      if (
        createPoll.executeTo === undefined ||
        createPoll.executeMsg === undefined
      ) {
        throw new Error(
          'both --execute-to and --execute-msg must be supplied if either is'
        );
      }
      executeMsg = {
        contract: createPoll.executeTo,
        msg: Buffer.from(createPoll.executeMsg).toString('base64'),
      };
    }

    await handleExecCommand(exec, async mirror =>
      mirror.gov.createPoll(
        mirror.mirrorToken,
        Parse.uint128(createPoll.deposit),
        createPoll.title,
        createPoll.desc,
        createPoll.link,
        executeMsg
      )
    );
  });

const executePoll = exec
  .command('execute-poll <poll-id>')
  .description(`Executes the poll`, {
    pollId: '(int) poll id',
  })
  .action(async (pollId: string) => {
    await handleExecCommand(exec, async mirror =>
      mirror.gov.executePoll(Parse.int(pollId))
    );
  });

const endPoll = exec
  .command('end-poll <poll-id>')
  .description(`Ends a poll`, {
    pollId: '(int) poll id',
  })
  .action(async (pollId: string) => {
    await handleExecCommand(exec, async mirror =>
      mirror.gov.endPoll(Parse.int(pollId))
    );
  });

const expirePoll = exec
  .command('expire-poll <poll-id>')
  .description(`Expires a poll`, {
    pollId: '(int) poll id',
  })
  .action(async (pollId: string) => {
    await handleExecCommand(exec, async mirror =>
      mirror.gov.expirePoll(Parse.int(pollId))
    );
  });

const stake = exec
  .command('stake <amount>')
  .description(`Stake MIR tokens in governance`, {
    amount: '(Uint128) amount of MIR tokens to stake',
  })
  .action(async (amount: string) => {
    await handleExecCommand(exec, async mirror =>
      mirror.gov.stakeVotingTokens(mirror.mirrorToken, Parse.uint128(amount))
    );
  });

const unstake = exec
  .command('unstake [amount]')
  .description(`Unstake MIR tokens in governance`, {
    amount: '(Uint128) amount of MIR tokens to unstake',
  })
  .action(async (amount: string) => {
    await handleExecCommand(exec, async mirror =>
      mirror.gov.withdrawVotingTokens(Parse.uint128(amount))
    );
  });

const query = createQueryMenu('gov', 'Mirror Gov contract queries');
const getConfig = query
  .command('config')
  .description('Query Mirror Gov contract config')
  .action(async () => {
    await handleQueryCommand(query, async mirror => mirror.gov.getConfig());
  });

const getPoll = query
  .command('poll <poll-id>')
  .description('Query poll')
  .action(async (pollId: string) => {
    await handleQueryCommand(query, async mirror =>
      mirror.gov.getPoll(Parse.int(pollId))
    );
  });

const getPolls = query
  .command('polls')
  .description('Query all polls')
  .option(
    '--filter <string>',
    `poll state to filter ('in_progress', 'passed', 'rejected', 'executed')`
  )
  .option('--start-after <int>', 'poll ID to start query from')
  .option('--limit <int>', 'max results to return')
  .action(async () => {
    await handleQueryCommand(query, async mirror => {
      if (
        getPolls.filter &&
        !['in_progress', 'passed', 'rejected', 'executed'].includes(
          getPolls.filter
        )
      ) {
        throw new Error(
          `invalid filter ${getPolls.filter}; MUST be one of: 'in_progress', 'passed', 'rejected', 'executed'`
        );
      }
      return mirror.gov.getPolls(
        getPolls.filter,
        Parse.int(getPolls.startAfter),
        Parse.int(getPolls.limit)
      );
    });
  });

const getStaker = query
  .command('staker <address>')
  .description('Query MIR staker', {
    staker: '(AccAddress) staker address to query',
  })
  .action(async (address: string) => {
    await handleQueryCommand(query, async mirror =>
      mirror.gov.getStaker(Parse.accAddress(address))
    );
  });

const getState = query
  .command('state')
  .description('Query Mirror Gov state')
  .action(async () => {
    await handleQueryCommand(query, async mirror => mirror.gov.getState());
  });

const getVoters = query
  .command('voters <poll-id>')
  .description('Query voter for a poll')
  .option('--start-after <string>', 'voter prefix to start query from')
  .option('--limit <int>', 'max results to return')
  .action(async (pollId: string) => {
    await handleQueryCommand(query, async mirror =>
      mirror.gov.getVoters(
        Parse.int(pollId),
        getVoters.startAfter,
        Parse.int(getVoters.limit)
      )
    );
  });

export default {
  exec,
  query,
};
