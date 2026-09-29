document.addEventListener('DOMContentLoaded', () => {
  // Fetch and render dashboard cards
  fetch('/api/github/metrics')
    .then(response => response.json())
    .then(data => {
      const dashboardCards = document.getElementById('dashboard-cards');
      const cards = [
        { title: 'Copilot Credits', value: data.copilotUsage.credits },
        { title: 'Open Tickets', value: data.ticketStatus.open },
        { title: 'Upcoming Deadlines', value: data.deadlines.length },
      ];
      cards.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.innerHTML = `<h3>${card.title}</h3><p>${card.value}</p>`;
        dashboardCards.appendChild(cardDiv);
      });
    });

  // Fetch and render team profiles
  const teamSection = document.getElementById('team-section');
  const teamMembers = [
    { name: 'Alice', role: 'Developer' },
    { name: 'Bob', role: 'DevOps' },
    { name: 'Charlie', role: 'Designer' },
  ];
  teamMembers.forEach(member => {
    const profileDiv = document.createElement('div');
    profileDiv.className = 'team-profile';
    profileDiv.innerHTML = `<h3>${member.name}</h3><p>${member.role}</p>`;
    teamSection.appendChild(profileDiv);
  });

  // Fetch and render notifications
  fetch('/api/notifications')
    .then(response => response.json())
    .then(notifications => {
      const notificationsSection = document.getElementById('notifications');
      notifications.forEach(notification => {
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification';
        notificationDiv.innerHTML = `<p>${notification.message}</p>`;
        notificationsSection.appendChild(notificationDiv);
      });
    });

  // Toggle light/dark mode
  const toggleButton = document.getElementById('theme-toggle');
  toggleButton.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const header = document.querySelector('header');
    const progressIndicator = document.querySelector('.progress-indicator');
    const cards = document.querySelectorAll('.card');
    const teamProfiles = document.querySelectorAll('.team-profile');
    const kanbanColumns = document.querySelectorAll('.kanban-column');
    const notifications = document.querySelectorAll('.notification');

    header.classList.toggle('dark-mode');
    progressIndicator.classList.toggle('dark-mode');
    cards.forEach(card => card.classList.toggle('dark-mode'));
    teamProfiles.forEach(profile => profile.classList.toggle('dark-mode'));
    kanbanColumns.forEach(column => column.classList.toggle('dark-mode'));
    notifications.forEach(notification => notification.classList.toggle('dark-mode'));
  });
});