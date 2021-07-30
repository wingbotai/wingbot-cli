/**
 * @author Ales Kalfas
 */
'use strict';

/**
  *
  * @param {import('./resultToExport').Export[]} exports
  * @param {object} additionalInfo
  * @returns
  */
const transform = (exports, additionalInfo = {}) => {
    const questions = [['User ID', 'Question ID', 'Question category', 'Question name', 'Question text', 'Answer text', 'Answer value', 'Duration [s]']];
    const users = [['User ID', 'Email', 'Logic finished', 'Score logic', 'Score odvaha', 'Score spoluprace', 'Score sdilnost', 'Score lzi', 'Score spolehlivost', 'Score proaktivita', 'Score nezdolnost']];

    exports.forEach((exp) => {
        exp.questions.forEach((question) => {
            const questionsLine = [
                exp.userId,
                question.questionId,
                question.category,
                question.questionName,
                question.questionText,
                question.answerText,
                question.answerValue,
                Math.round(question.duration / 1000)
            ];
            // @ts-ignore
            questions.push(questionsLine);
        });
        const userLine = [
            exp.userId,
            exp.email,
            `${exp.logicFinished}`,
            exp.logicScore,
            exp.psychoScoreMap.odvaha,
            exp.psychoScoreMap.spoluprace,
            exp.psychoScoreMap.sdilnost,
            exp.psychoScoreMap.lzi,
            exp.psychoScoreMap.spolehlivost,
            exp.psychoScoreMap.proaktivita,
            exp.psychoScoreMap.nezdolnost
        ];
        // @ts-ignore
        users.push(userLine);
    });

    const info = [
        ['Questions count', questions.length - 1],
        ['Users count', users.length - 1],
        ...Object.entries(additionalInfo).map(([k, v]) => ([k, v]))
    ];

    return [{ name: 'Questions', data: questions }, { name: 'Users', data: users }, { name: 'Info', data: info }];
};

module.exports = transform;
