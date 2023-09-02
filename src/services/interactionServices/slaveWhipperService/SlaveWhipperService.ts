import isHelperThread from "../../../utils/isHelperThread";
import helperThreadToRoleName from "../../../utils/threadToHelperRole";
import InteractionService from "../InteractionService";

export default class SlaveWhipperService extends InteractionService {
  public async handleWhipSlaves() {
    await this.interaction.deferReply();

    const thread = this.interaction.channel;
    const role = helperThreadToRoleName(thread);

    if (isHelperThread) {
      await this.interaction.editReply({
        content: `<@&${role.id}>, get to work! 𓀓𓀝`,
      });
    } else {
      await this.interaction.editReply({
        content: "Please don't whip the slaves outside of threads",
      });
    }
  }
}
