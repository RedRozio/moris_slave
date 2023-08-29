import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ColorResolvable,
  ComponentType,
  Guild,
  GuildMemberRoleManager,
  Interaction,
  SelectMenuType,
  StringSelectMenuBuilder,
} from "discord.js";

import { SelectMenuBuilder } from "@discordjs/builders";
import * as yup from "yup";
import {
  CATEGORY_CHANNEL_NAME,
  CATEGORY_CHANNEL_TYPE,
  FORUM_CHANNEL_TYPE,
} from "../../constants/channels";
import { SELECT_HELPER_ROLES_ID } from "../../constants/inputIds";
import helperSchema from "./helperSchema";

/**
 * Handles creating subjects with roles and channels for helping others
 */
export default class SubjectHelperService {
  private guild: Guild;
  private interaction: ChatInputCommandInteraction;
  private categoryChannelId: string;

  constructor(interaction: ChatInputCommandInteraction) {
    this.interaction = interaction;
    this.guild = interaction.guild;
  }

  /**
   * Allows a user to select which helper roles they want
   */
  public async handleBecomeHelper() {
    // Fetch all helper roles
    const helperRoles = this.guild.roles.cache
      .filter((r) => r.name.endsWith("-helper"))
      .map((r) => ({
        id: r.id,
        role: r.name,
        subject:
          r.name[0].toUpperCase() + r.name.slice(1).replace("-helper", ""),
      }));

    // Create a select for each subject
    const subjectSelect = new StringSelectMenuBuilder({
      custom_id: SELECT_HELPER_ROLES_ID,
      placeholder: "Select a subject to become a helper",
      min_values: 0,
      options: helperRoles.map((r) => ({
        label: r.subject,
        value: r.id,
      })),
      type: ComponentType.StringSelect,
    });

    // Create an action row holding the select
    const actionRow = new ActionRowBuilder<SelectMenuBuilder>().addComponents(
      subjectSelect
    );

    // Reply with option to select
    const response = await this.interaction.reply({
      components: [actionRow],
      ephemeral: true,
      content: "Please select one or more subjects",
    });

    // Setup a collector filter to listen for the user's selection
    const collectorFilter = (i: Interaction) =>
      i.user.id === this.interaction.user.id;

    try {
      // Wait for reply
      const selectedSubjects =
        await response.awaitMessageComponent<SelectMenuType>({
          filter: collectorFilter,
          time: 10000,
        });

      this.interaction.deleteReply();

      const selectedRole = helperRoles.find(
        (r) => r.id === selectedSubjects.values[0]
      );

      // Add the role to the user
      // Check that the user does not already have the role
      if (
        (this.interaction.member.roles as GuildMemberRoleManager).cache.has(
          selectedRole.id
        )
      ) {
        selectedSubjects.reply({
          content: `You already have the role ${selectedRole.role}! So I won't add it again.`,
          ephemeral: true,
        });
        return;
      } else {
        await (this.interaction.member.roles as GuildMemberRoleManager).add(
          selectedRole.id
        );
      }

      await selectedSubjects.reply({
        content: `Congrats on becoming a helper in ${selectedRole.subject}! Thanks for helping out the community <3.\nYou have been promoted to ${selectedRole.role} and will be pinged whenever someone posts in the ${selectedRole.subject} forum channel.`,
        ephemeral: true,
      });

      await selectedSubjects.followUp({
        content: `Congrats to ${this.interaction.user.displayName} for becoming a helper in ${selectedRole.subject}!`,
      });
    } catch (err) {
      throw err;
    }
  }

  /**
   * Creates a new helper subject
   * This creates a channel for the subjects, and a role for helpers
   * If the function returns false, the action was not completed successfully
   * @param subjectName The name of the subject, ex. "Math"
   */
  public async handleCreateSubject() {
    const { color, emoji, name } = await this.getOptions();

    // Make sure the subject does not exist
    if (!(await this.isSubjectNameUnique(name))) {
      this.interaction.reply({
        content: "Subject already exists!",
        ephemeral: true,
      });
      throw new Error("Subject already exists!");
    }

    // Create a channel within the channel category
    const forum = await this.createSubjectForum(name, emoji);

    // Create a role for helpers of this subject
    const role = await this.createSubjectRole(name, color as ColorResolvable);

    await this.interaction.reply({
      content: `Subject ${forum.url} and role **${role.name}** created!`,
    });
  }

  /**
   * Returns the category channel where all helper subject channels should be within
   * @returns The id of the category
   */
  private async getCategoryId() {
    if (this.categoryChannelId) return this.categoryChannelId;

    const category = this.guild.channels.cache.find(
      (c) =>
        c.type === CATEGORY_CHANNEL_TYPE && c.name === CATEGORY_CHANNEL_NAME
    );

    // If it does not exist, create it
    if (!category) {
      const newCategory = await this.guild.channels.create({
        name: CATEGORY_CHANNEL_NAME,
        type: CATEGORY_CHANNEL_TYPE,
      });
      this.categoryChannelId = newCategory.id;
      return newCategory.id;
    } else {
      this.categoryChannelId = category.id;
      return category.id;
    }
  }

  /**
   * Creates a forum channel for a given subject name
   */
  private async createSubjectForum(subjectName: string, emoji: string) {
    const categoryId = await this.getCategoryId();
    return this.guild.channels.create({
      name: `${emoji}-${subjectName}`,
      parent: categoryId,
      type: FORUM_CHANNEL_TYPE,
    });
  }

  /**
   * Creates a user helper role for a subject
   */
  private async createSubjectRole(subjectName: string, color: ColorResolvable) {
    return this.guild.roles.create({
      name: `${subjectName.toLowerCase()}-helper`, // Replace with the desired role name
      color: color, // Replace with the desired color (optional)
    });
  }

  /**
   *
   * @param subjectName The name of the subject
   * @returns True if it does not exist, else false
   */
  private async isSubjectNameUnique(subjectName: string) {
    // Query all subjects (query channels within the helper category)
    const categoryId = await this.getCategoryId();

    // Find all channels within the category
    const channels = this.guild.channels.cache.filter(
      (c) =>
        c.parentId === categoryId && c.name.includes(subjectName.toLowerCase())
    ).values;
    return !channels.length;
  }

  private async getOptions(): Promise<yup.InferType<typeof helperSchema>> {
    const options = this.interaction.options.data;

    // Convert interaction options to an object
    const optionsObject = {};
    for (const option of options) {
      optionsObject[option.name] = option.value;
    }

    // Validate using yup
    try {
      const cleanedSchema = await helperSchema.validate(optionsObject);
      return cleanedSchema;
    } catch (error) {
      await this.interaction.reply({
        content: "Error: " + error.message,
        ephemeral: true,
      });
      throw error;
    }
  }
}