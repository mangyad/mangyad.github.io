<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
    <style>
      .scroll-container::-webkit-scrollbar { width: 6px; }
      .scroll-container::-webkit-scrollbar-track { background: #f1f1f1; }
      .scroll-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    </style>
  </head>
  <body class="bg-gray-50 p-2 sm:p-4 flex justify-center items-center min-h-screen font-sans">
    <div class="bg-white p-4 sm:p-6 rounded-xl shadow-md w-full max-w-md flex flex-col md:h-[550px] h-auto min-h-[400px]">
      
      <div class="mb-4 flex justify-between items-start">
        <div class="max-w-[70%]">
          <h2 class="text-lg font-bold text-gray-800 truncate">Match Predictions</h2>
          <p id="user-email" class="text-[11px] text-gray-500 truncate">Authenticating...</p>
        </div>
        <button onclick="goToHistory()" class="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg font-medium transition">History</button>
      </div>

      <div class="mb-4">
        <div class="flex items-center justify-between border border-gray-200 rounded-lg bg-gray-50 p-1">
          <button id="prev-date-btn" onclick="navigateDate(-1)" class="px-3 py-1.5 hover:bg-white rounded-md text-gray-600 disabled:opacity-20 font-bold transition">&larr;</button>
          <span id="date-display" class="text-xs font-semibold text-gray-700">Checking schedule...</span>
          <button id="next-date-btn" onclick="navigateDate(1)" class="px-3 py-1.5 hover:bg-white rounded-md text-gray-600 disabled:opacity-20 font-bold transition">&rarr;</button>
        </div>
      </div>

      <div id="matches-container" class="md:flex-1 md:overflow-y-auto mb-4 space-y-3 overflow-y-visible pr-1">
        <p class="text-gray-400 text-center py-8 text-sm">Loading available matches...</p>
      </div>

      <div class="mt-auto">
        <button id="submit-btn" onclick="submitData()" disabled class="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm">
          Submit Predictions
        </button>
        <p id="status" class="text-center text-xs mt-2 hidden"></p>
      </div>
    </div>

    <script>
      let availableDates = [];
      let currentDateIndex = 0;

      window.onload = function() {
        google.script.run.withSuccessHandler(email => { 
          document.getElementById('user-email').innerText = email; 
        }).getUserEmail();

        google.script.run.withSuccessHandler(dates => {
          if (dates.length === 0) {
            document.getElementById('date-display').innerText = "No Matches Visible";
            document.getElementById('matches-container').innerHTML = '<p class="text-gray-400 text-center py-8 text-sm">No scheduled matches found.</p>';
            return;
          }
          availableDates = dates;
          updateDateView();
        }).getAvailableDates();
      };

      function updateDateView() {
        const currentDate = availableDates[currentDateIndex];
        const parsed = new Date(currentDate + "T00:00:00");
        document.getElementById('date-display').innerText = parsed.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        document.getElementById('prev-date-btn').disabled = (currentDateIndex === 0);
        document.getElementById('next-date-btn').disabled = (currentDateIndex === availableDates.length - 1);
        loadMatches(currentDate);
      }

      function navigateDate(dir) { currentDateIndex += dir; updateDateView(); }

      function createScoreOptions() {
        let html = '<option value="" disabled selected>-</option>';
        for (let i = 0; i <= 10; i++) { html += `<option value="${i}">${i}</option>`; }
        return html;
      }

      function loadMatches(dateStr) {
        const container = document.getElementById('matches-container');
        const submitBtn = document.getElementById('submit-btn');
        container.innerHTML = '<p class="text-gray-500 text-center py-8 text-sm">Fetching matches...</p>';
        submitBtn.disabled = true;

        google.script.run.withSuccessHandler(matches => {
          container.innerHTML = '';
          const opts = createScoreOptions();
          
          matches.forEach(match => {
            const card = document.createElement('div');
            card.className = "prediction-card p-3 border border-gray-100 rounded-xl bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-2";
            card.setAttribute('data-match', match);
            card.innerHTML = `
              <span class="text-xs font-semibold text-gray-700 truncate w-full sm:w-1/2">${match}</span>
              <div class="flex items-center gap-2 shrink-0">
                <select class="score1 w-16 p-1.5 border border-gray-300 rounded-lg text-center text-sm bg-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer">
                  ${opts}
                </select>
                <span class="text-gray-400 font-bold text-[10px]">VS</span>
                <select class="score2 w-16 p-1.5 border border-gray-300 rounded-lg text-center text-sm bg-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer">
                  ${opts}
                </select>
              </div>`;
            container.appendChild(card);
          });

          // Pre-fill existing entries
          google.script.run.withSuccessHandler(existing => {
            for (const m in existing) {
              const row = container.querySelector(`[data-match="${m}"]`);
              if (row) {
                row.querySelector('.score1').value = existing[m].score1;
                row.querySelector('.score2').value = existing[m].score2;
                row.classList.replace('bg-gray-50', 'bg-blue-50');
                row.classList.replace('border-gray-100', 'border-blue-100');
              }
            }
            submitBtn.disabled = false;
          }).getExistingPredictionsForUser(matches);
        }).getMatchesForDate(dateStr);
      }

      function submitData() {
        const cards = document.querySelectorAll('.prediction-card');
        const predictions = [];
        let valid = true;
        
        cards.forEach(card => {
          const match = card.getAttribute('data-match');
          const s1 = card.querySelector('.score1').value;
          const s2 = card.querySelector('.score2').value;
          
          if (s1 === "" || s2 === "") valid = false;
          predictions.push({ match: match, score1: s1, score2: s2 });
        });

        if (!valid) {
          showStatus("Please choose scores for all matches.", "text-red-500");
          return;
        }

        document.getElementById('submit-btn').disabled = true;
        showStatus("Saving...", "text-blue-500");

        google.script.run.withSuccessHandler(msg => {
          showStatus(msg, msg.includes("Error") ? "text-red-500" : "text-green-600");
          document.getElementById('submit-btn').disabled = false;
          // Refresh data to show blue "saved" status
          const current = availableDates[currentDateIndex];
          loadMatches(current);
        }).submitPredictions(predictions);
      }

      function showStatus(t, c) {
        const s = document.getElementById('status');
        s.innerText = t; s.className = `text-center text-xs mt-2 block ${c}`;
        s.classList.remove('hidden');
      }

      function goToHistory() {
        google.script.run.withSuccessHandler(html => { 
          document.open(); document.write(html); document.close(); 
        }).getPageHtml('History');
      }
    </script>
  </body>
</html>
