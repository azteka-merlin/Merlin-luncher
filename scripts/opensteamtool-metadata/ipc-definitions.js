module.exports = {
  interfaces: [
    {
      name: 'IClientUser',
      interface_id: 1,
      methods: [
        { name: 'GetSteamID', argc: 0 },
        { name: 'GetAppOwnershipTicketExtendedData', argc: 2 },
        { name: 'RequestEncryptedAppTicket', argc: 2 },
        { name: 'GetEncryptedAppTicket', argc: 1 }
      ]
    },
    {
      name: 'IClientUtils',
      interface_id: 4,
      methods: [
        { name: 'GetAppID', argc: 0 },
        { name: 'GetAPICallResult', argc: 3 }
      ]
    }
  ]
};
