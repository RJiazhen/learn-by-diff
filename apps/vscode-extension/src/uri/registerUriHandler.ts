import * as vscode from "vscode";
import type { GitClient } from "../git/client.ts";
import { openCourse } from "../workspace/openCourse.ts";
import type { LearningSession } from "../workspace/loader.ts";
import { parseOpenCourseUri, type OpenCourseUriError } from "./parseOpenCourseUri.ts";

/**
 * Handles `vscode://` / `cursor://` deep links for this extension.
 *
 * Authority is `RuanJiazhen.learn-by-diff`. Path `/open?url=…` opens a course.
 */
export class LearnByDiffUriHandler implements vscode.UriHandler {
  /**
   * Creates a URI handler bound to the shared open-course flow.
   *
   * @param git - Git CLI client
   * @param output - Output channel for clone/materialize logs
   * @param onSession - Updates Explorer / status when opening in place
   */
  constructor(
    private readonly git: GitClient,
    private readonly output: vscode.OutputChannel,
    private readonly onSession: (session: LearningSession | undefined) => void,
  ) {}

  /**
   * Handles an incoming system URI (browser click or OS open).
   *
   * @param uri - Extension URI (`vscode://RuanJiazhen.learn-by-diff/…`)
   */
  handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    return this.handleUriAsync(uri);
  }

  /**
   * Async implementation of {@link handleUri}.
   */
  private async handleUriAsync(uri: vscode.Uri): Promise<void> {
    const parsed = parseOpenCourseUri(uri);
    if (!parsed.ok) {
      void vscode.window.showErrorMessage(openCourseUriErrorMessage(parsed.error));
      return;
    }

    this.output.appendLine(vscode.l10n.t("Deep link: open course {0}", parsed.courseRepoUrl));
    this.output.show(true);
    await openCourse({
      courseRepoUrl: parsed.courseRepoUrl,
      parentDir: parsed.parentDir,
      git: this.git,
      output: this.output,
      onSession: this.onSession,
    });
  }
}

/**
 * Registers the deep-link URI handler for LearnByDiff.
 *
 * @param context - Extension context
 * @param git - Git CLI client
 * @param output - Shared output channel
 * @param onSession - Session UI updater
 */
export function registerUriHandler(
  context: vscode.ExtensionContext,
  git: GitClient,
  output: vscode.OutputChannel,
  onSession: (session: LearningSession | undefined) => void,
): void {
  context.subscriptions.push(
    vscode.window.registerUriHandler(new LearnByDiffUriHandler(git, output, onSession)),
  );
}

/**
 * Returns a localized error for a deep-link parse failure.
 *
 * @param error - Structured failure from {@link parseOpenCourseUri}
 */
function openCourseUriErrorMessage(error: OpenCourseUriError): string {
  if (error.kind === "unknownPath") {
    return vscode.l10n.t(
      "Unknown LearnByDiff link path “{0}”. Use /open?url=<course.yml-or-repo>.",
      error.path,
    );
  }
  if (error.kind === "missingUrl") {
    return vscode.l10n.t("LearnByDiff open link is missing a url query parameter.");
  }
  return vscode.l10n.t("Invalid parent folder in LearnByDiff link: {0}", error.parentRaw);
}
