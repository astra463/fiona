function handleError(
  bot,
  logger,
  chatId,
  error,
  message = 'Произошла ошибка.'
) {
  bot.sendMessage(chatId, message);
  logger.error(error.message);
}

export default handleError;
