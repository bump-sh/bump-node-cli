import Command from '../command';
import * as flags from '../flags';
import { Diff as CoreDiff } from '../core/diff';
import { fileArg, otherFileArg } from '../args';
import { cli } from '../cli';
import { WithDiff } from '../api/models';

export default class Diff extends Command {
  static description =
    'Get a comparaison diff with your documentation from the given file or URL';

  static examples = [
    `Compare a potential new version with the currently published one:

  $ bump diff FILE --doc <your_doc_id_or_slug> --token <your_doc_token>
  * Let's compare the given definition file with the currently deployed one... done
  Removed: GET /compare
  Added: GET /versions/{versionId}
`,
    `Store the diff in a dedicated file:

  $ bump diff FILE --doc <doc_slug> --token <doc_token> > /tmp/my-saved-diff
  * Let's compare the given definition file with the currently deployed one... done

  $ cat /tmp/my-saved-diff
  Removed: GET /compare
  Added: GET /versions/{versionId}
`,
    `In case of a non modified definition FILE compared to your existing documentation, no changes are output:

  $ bump diff FILE --doc <doc_slug> --token <your_doc_token>
  * Let's compare the given definition file with the currently deployed one... done
   ›   Warning: Your documentation has not changed
`,
    `Compare two different input files or URL independently to the one published on bump.sh

  $ bump diff FILE FILE2 --doc <doc_slug> --token <your_doc_token>
  * Let's compare the two given definition files... done
  Updated: POST /versions
    Body attribute added: previous_version_id
`,
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    doc: flags.doc(),
    hub: flags.hub(),
    token: flags.token(),
    open: flags.open({ description: 'Open the visual diff in your browser' }),
    format: flags.format(),
  };

  static args = [fileArg, otherFileArg];

  /*
    Oclif doesn't type parsed args & flags correctly and especially
    required-ness which is not known by the compiler, thus the use of
    the non-null assertion '!' in this command.
    See https://github.com/oclif/oclif/issues/301 for details
  */
  async run(): Promise<WithDiff | void> {
    const { args, flags } = this.parse(Diff);
    /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
    const [documentation, hub, token] = [flags.doc!, flags.hub, flags.token!];

    if (flags.format == 'text') {
      if (args.FILE2) {
        cli.action.start("* Let's compare the two given definition files");
      } else {
        cli.action.start(
          "* Let's compare the given definition file with the currently deployed one",
        );
      }
    }

    const diff: WithDiff | undefined = await new CoreDiff(this.config).run(
      args.FILE,
      args.FILE2,
      documentation,
      hub,
      token,
    );

    cli.action.stop();

    if (diff) {
      /* Flags format has a default value, so it's always defined. But
       * oclif types can"t detect it */
      /* eslint-disable-next-line @typescript-eslint/no-non-null-assertion */
      await this.displayCompareResult(diff, flags.format!, flags.open);
    } else {
      await cli.log('No changes detected.');
    }

    return;
  }

  async displayCompareResult(
    result: WithDiff,
    format: string,
    open: boolean,
  ): Promise<void> {
    if (format == 'text' && result.diff_summary) {
      await cli.log(result.diff_summary);
    } else if (format == 'markdown' && result.diff_markdown) {
      await cli.log(result.diff_markdown);
    } else if (format == 'json' && result.diff_details) {
      await cli.log(JSON.stringify(result.diff_details, null, 2));
    } else {
      await cli.log('No structural changes detected.');
    }

    if (open && result.diff_public_url) {
      await cli.open(result.diff_public_url);
    }
  }
}
