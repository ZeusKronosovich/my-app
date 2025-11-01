package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

const (
	host      = "localhost"
	port      = 5432
	user      = "postgres"
	dbname    = "betontrade"
	jwtSecret = "your_secret_key"
)

type contextKey string

const (
	claimsContextKey contextKey = "claims"
)

type Handlers struct {
	dbProvider DatabaseProvider
}

type DatabaseProvider struct {
	db *sql.DB
}

type Account struct {
	Login    string `json:"login"`
	Password string `json:"password"`
	Role     string `json:"role,omitempty"`
}

type User struct {
	Login string `json:"login"`
	Role  string `json:"role"`
}

type Order struct {
	Number      int    `json:"o_number"`
	BetonV      int    `json:"o_betonv"`
	BetonMark   string `json:"o_betonmark"`
	BetonTarget string `json:"o_betontarget"`
	BetonTime   string `json:"o_betontime"`
	CreatedTime string `json:"o_createdtime"`
	LogCreater  string `json:"o_logcreater"`
	Price       int    `json:"o_price"`
}

type OrderWithStatus struct {
	Order
	Status    string `json:"o_status"`
	MachineID *int   `json:"o_machine_id,omitempty"`
}

type Machine struct {
	ID          int    `json:"id"`
	PlateNumber string `json:"plate_number"`
	Type        string `json:"type"`
	Capacity    int    `json:"capacity"`
	IsActive    bool   `json:"is_active"`
}

type APIError struct {
	Message string `json:"message"`
	Code    int    `json:"code"`
}

type ConcretePriceCache struct {
	prices map[string]int
	mutex  sync.RWMutex
	expiry time.Time
}

var (
	registrationEnabled  = true
	orderCreationEnabled = true
	databaseSize         = "N/A"
	dbSizeMutex          = &sync.RWMutex{}
	priceCache           = &ConcretePriceCache{
		prices: make(map[string]int),
	}
)

func init() {
	go updateDatabaseSizePeriodically()
}

func updateDatabaseSizePeriodically() {
	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s dbname=%s sslmode=disable", host, port, user, dbname)
	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		log.Printf("Ошибка при создании соединения для обновления размера БД: %v", err)
		return
	}
	defer db.Close()

	size, err := getDatabaseSize(db)
	if err != nil {
		log.Printf("Ошибка при получении начального размера БД: %v", err)
	} else {
		dbSizeMutex.Lock()
		databaseSize = size
		dbSizeMutex.Unlock()
	}

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		size, err := getDatabaseSize(db)
		if err != nil {
			log.Printf("Ошибка при получении размера БД: %v", err)
			continue
		}

		dbSizeMutex.Lock()
		databaseSize = size
		dbSizeMutex.Unlock()
		log.Printf("Размер БД обновлен: %s", size)
	}
}

func getDatabaseSize(db *sql.DB) (string, error) {
	var size string
	err := db.QueryRow("SELECT pg_size_pretty(pg_database_size($1))", dbname).Scan(&size)
	if err != nil {
		return "N/A", err
	}
	return size, nil
}

func validateToken(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("неожиданный метод подписи: %v", token.Header["alg"])
		}
		return []byte(jwtSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("невалидный токен")
}

func extractAndValidateToken(r *http.Request) (jwt.MapClaims, error) {
	tokenString := r.Header.Get("Authorization")
	if tokenString == "" {
		return nil, fmt.Errorf("отсутствует токен")
	}

	tokenString = strings.TrimPrefix(tokenString, "Bearer ")
	return validateToken(tokenString)
}

func (h *Handlers) requireAuth(requiredRoles ...string) mux.MiddlewareFunc {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := extractAndValidateToken(r)
			if err != nil {
				h.handleError(w, fmt.Errorf("неверный или просроченный токен"), http.StatusUnauthorized)
				return
			}

			if len(requiredRoles) > 0 {
				role := claims["role"].(string)
				hasAccess := false
				for _, requiredRole := range requiredRoles {
					if role == requiredRole {
						hasAccess = true
						break
					}
				}
				if !hasAccess {
					h.handleError(w, fmt.Errorf("доступ запрещен"), http.StatusForbidden)
					return
				}
			}

			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func getClaimsFromContext(ctx context.Context) (jwt.MapClaims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(jwt.MapClaims)
	return claims, ok
}

func (h *Handlers) handleError(w http.ResponseWriter, err error, statusCode int) {
	log.Printf("Ошибка: %v", err)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(APIError{
		Message: err.Error(),
		Code:    statusCode,
	})
}

func (h *Handlers) handleSuccess(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func (c *ConcretePriceCache) GetPrices(db *sql.DB) (map[string]int, error) {
	c.mutex.RLock()
	if time.Now().Before(c.expiry) && len(c.prices) > 0 {
		defer c.mutex.RUnlock()
		return c.prices, nil
	}
	c.mutex.RUnlock()

	c.mutex.Lock()
	defer c.mutex.Unlock()

	prices := make(map[string]int)
	rows, err := db.Query("SELECT grade, price FROM concrete_prices")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var grade string
		var price int
		if err := rows.Scan(&grade, &price); err != nil {
			return nil, err
		}
		prices[grade] = price
	}

	c.prices = prices
	c.expiry = time.Now().Add(5 * time.Minute)

	return prices, nil
}

func (c *ConcretePriceCache) Invalidate() {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	c.prices = make(map[string]int)
	c.expiry = time.Time{}
}

func (h *Handlers) PostAccount(w http.ResponseWriter, r *http.Request) {
	if !registrationEnabled {
		h.handleError(w, fmt.Errorf("регистрация новых пользователей временно отключена"), http.StatusServiceUnavailable)
		return
	}

	var input Account
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.handleError(w, err, http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		h.handleError(w, fmt.Errorf("ошибка хэширования пароля"), http.StatusInternalServerError)
		return
	}

	if err := h.dbProvider.InsertAccount(input.Login, string(hashedPassword), "user"); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	h.handleSuccess(w, map[string]string{"message": "Пользователь успешно создан"})
}

func (h *Handlers) PostLogin(w http.ResponseWriter, r *http.Request) {
	var input Account
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.handleError(w, err, http.StatusBadRequest)
		return
	}

	var storedPassword string
	var role string
	var isDeleted bool
	err := h.dbProvider.db.QueryRow("SELECT password, role, is_deleted FROM accounts WHERE login = $1", input.Login).Scan(&storedPassword, &role, &isDeleted)
	if err != nil {
		if err == sql.ErrNoRows {
			h.handleError(w, fmt.Errorf("логин или пароль неверны"), http.StatusUnauthorized)
			return
		}
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	if isDeleted {
		h.handleError(w, fmt.Errorf("аккаунт был удален"), http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedPassword), []byte(input.Password)); err != nil {
		h.handleError(w, fmt.Errorf("логин или пароль неверны"), http.StatusUnauthorized)
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"login": input.Login,
		"role":  role,
		"exp":   time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"token": tokenString,
		"login": input.Login,
		"role":  role,
	}

	h.handleSuccess(w, response)
}

func (h *Handlers) GetOrders(w http.ResponseWriter, r *http.Request) {
	claims, ok := getClaimsFromContext(r.Context())
	if !ok {
		h.handleError(w, fmt.Errorf("ошибка получения данных аутентификации"), http.StatusUnauthorized)
		return
	}

	login := claims["login"].(string)

	rows, err := h.dbProvider.SelectOrders(login)
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var order Order
		if err := rows.Scan(&order.Number, &order.BetonV, &order.BetonMark, &order.BetonTarget, &order.BetonTime, &order.CreatedTime, &order.LogCreater, &order.Price); err != nil {
			h.handleError(w, err, http.StatusInternalServerError)
			return
		}
		orders = append(orders, order)
	}

	if len(orders) == 0 {
		h.handleSuccess(w, []Order{})
		return
	}

	h.handleSuccess(w, orders)
}

func (h *Handlers) GetOrdersWithStatus(w http.ResponseWriter, r *http.Request) {
	claims, ok := getClaimsFromContext(r.Context())
	if !ok {
		h.handleError(w, fmt.Errorf("ошибка получения данных аутентификации"), http.StatusUnauthorized)
		return
	}

	login := claims["login"].(string)

	rows, err := h.dbProvider.GetOrdersWithStatus(login)
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []OrderWithStatus
	for rows.Next() {
		var order OrderWithStatus
		var machineID sql.NullInt64
		if err := rows.Scan(&order.Number, &order.BetonV, &order.BetonMark, &order.BetonTarget,
			&order.BetonTime, &order.CreatedTime, &order.LogCreater, &order.Price,
			&order.Status, &machineID); err != nil {
			h.handleError(w, err, http.StatusInternalServerError)
			return
		}
		if machineID.Valid {
			machineIDInt := int(machineID.Int64)
			order.MachineID = &machineIDInt
		}
		orders = append(orders, order)
	}

	if len(orders) == 0 {
		h.handleSuccess(w, []OrderWithStatus{})
		return
	}

	h.handleSuccess(w, orders)
}

func (h *Handlers) PostOrder(w http.ResponseWriter, r *http.Request) {
	if !orderCreationEnabled {
		h.handleError(w, fmt.Errorf("создание заказов временно отключено"), http.StatusServiceUnavailable)
		return
	}

	claims, ok := getClaimsFromContext(r.Context())
	if !ok {
		h.handleError(w, fmt.Errorf("ошибка получения данных аутентификации"), http.StatusUnauthorized)
		return
	}

	login := claims["login"].(string)

	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	order.CreatedTime = time.Now().Format(time.RFC3339)
	order.LogCreater = login

	if err := h.dbProvider.InsertOrder(order); err != nil {
		h.handleError(w, fmt.Errorf("ошибка при добавлении заказа"), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	h.handleSuccess(w, order)
}

func (h *Handlers) GetAllOrders(w http.ResponseWriter, r *http.Request) {
	rows, err := h.dbProvider.SelectAllOrders()
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var order Order
		if err := rows.Scan(&order.Number, &order.BetonV, &order.BetonMark, &order.BetonTarget, &order.BetonTime, &order.CreatedTime, &order.LogCreater, &order.Price); err != nil {
			h.handleError(w, err, http.StatusInternalServerError)
			return
		}
		orders = append(orders, order)
	}

	h.handleSuccess(w, orders)
}

func (h *Handlers) GetAllOrdersWithStatus(w http.ResponseWriter, r *http.Request) {
	rows, err := h.dbProvider.GetAllOrdersWithStatus()
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var orders []OrderWithStatus
	for rows.Next() {
		var order OrderWithStatus
		var machineID sql.NullInt64
		if err := rows.Scan(&order.Number, &order.BetonV, &order.BetonMark, &order.BetonTarget,
			&order.BetonTime, &order.CreatedTime, &order.LogCreater, &order.Price,
			&order.Status, &machineID); err != nil {
			h.handleError(w, err, http.StatusInternalServerError)
			return
		}
		if machineID.Valid {
			machineIDInt := int(machineID.Int64)
			order.MachineID = &machineIDInt
		}
		orders = append(orders, order)
	}

	h.handleSuccess(w, orders)
}

func (h *Handlers) UpdateOrder(w http.ResponseWriter, r *http.Request) {
	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	if err := h.dbProvider.UpdateOrder(order); err != nil {
		h.handleError(w, fmt.Errorf("ошибка при обновлении заказа"), http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, order)
}

func (h *Handlers) UpdateOrderWithStatus(w http.ResponseWriter, r *http.Request) {
	var order OrderWithStatus
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	if err := h.dbProvider.UpdateOrderWithStatus(order); err != nil {
		h.handleError(w, fmt.Errorf("ошибка при обновлении заказа"), http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, order)
}

func (h *Handlers) DeleteOrder(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	orderID := vars["id"]

	if err := h.dbProvider.DeleteOrder(orderID); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, map[string]string{"message": "Заказ успешно удален"})
}

func (h *Handlers) GetConcretePrices(w http.ResponseWriter, r *http.Request) {
	prices, err := priceCache.GetPrices(h.dbProvider.db)
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	h.handleSuccess(w, prices)
}

func (h *Handlers) UpdateConcretePrices(w http.ResponseWriter, r *http.Request) {
	var prices map[string]int
	if err := json.NewDecoder(r.Body).Decode(&prices); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	for grade, price := range prices {
		if err := h.dbProvider.UpdateConcretePrice(grade, price); err != nil {
			h.handleError(w, fmt.Errorf("ошибка обновления цен"), http.StatusInternalServerError)
			return
		}
	}

	priceCache.Invalidate()
	h.handleSuccess(w, map[string]string{"message": "Цены успешно обновлены"})
}

func (h *Handlers) GetConcreteGrades(w http.ResponseWriter, r *http.Request) {
	grades, err := h.dbProvider.GetConcreteGrades()
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	h.handleSuccess(w, grades)
}

func (h *Handlers) AddConcreteGrade(w http.ResponseWriter, r *http.Request) {
	var gradeData struct {
		Grade string `json:"grade"`
		Price int    `json:"price"`
	}

	if err := json.NewDecoder(r.Body).Decode(&gradeData); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	if err := h.dbProvider.AddConcreteGrade(gradeData.Grade, gradeData.Price); err != nil {
		h.handleError(w, fmt.Errorf("ошибка добавления марки бетона"), http.StatusInternalServerError)
		return
	}

	priceCache.Invalidate()
	w.WriteHeader(http.StatusCreated)
	h.handleSuccess(w, map[string]string{"message": "Марка бетона успешно добавлена"})
}

func (h *Handlers) DeleteConcreteGrade(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	grade := vars["grade"]

	if err := h.dbProvider.DeleteConcreteGrade(grade); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	priceCache.Invalidate()
	h.handleSuccess(w, map[string]string{"message": "Марка бетона успешно удалена"})
}

func (h *Handlers) GetAllUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.dbProvider.GetAllUsers()
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	h.handleSuccess(w, users)
}

func (h *Handlers) UpdateUser(w http.ResponseWriter, r *http.Request) {
	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	if err := h.dbProvider.UpdateUser(user); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, map[string]string{"message": "Пользователь успешно обновлен"})
}

func (h *Handlers) DeleteUser(w http.ResponseWriter, r *http.Request) {
	claims, ok := getClaimsFromContext(r.Context())
	if !ok {
		h.handleError(w, fmt.Errorf("ошибка получения данных аутентификации"), http.StatusUnauthorized)
		return
	}

	currentLogin := claims["login"].(string)

	vars := mux.Vars(r)
	userLogin := vars["login"]

	if userLogin == currentLogin {
		h.handleError(w, fmt.Errorf("нельзя удалить собственный аккаунт"), http.StatusBadRequest)
		return
	}

	protectedAccounts := []string{"admin", "seller"}
	for _, protected := range protectedAccounts {
		if userLogin == protected {
			h.handleError(w, fmt.Errorf("нельзя удалить системного пользователя"), http.StatusBadRequest)
			return
		}
	}

	if err := h.dbProvider.DeleteUser(userLogin); err != nil {
		h.handleError(w, fmt.Errorf("ошибка при удалении пользователя"), http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, map[string]string{"message": "Пользователь успешно удален"})
}

func (h *Handlers) CreateUser(w http.ResponseWriter, r *http.Request) {
	if !registrationEnabled {
		h.handleError(w, fmt.Errorf("регистрация новых пользователей временно отключена"), http.StatusServiceUnavailable)
		return
	}

	var input Account
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		h.handleError(w, fmt.Errorf("ошибка хэширования пароля"), http.StatusInternalServerError)
		return
	}

	if err := h.dbProvider.InsertAccount(input.Login, string(hashedPassword), input.Role); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	h.handleSuccess(w, map[string]string{"message": "Пользователь успешно создан"})
}

func (h *Handlers) GetAppStats(w http.ResponseWriter, r *http.Request) {
	var totalUsers int
	if err := h.dbProvider.db.QueryRow("SELECT COUNT(*) FROM accounts WHERE is_deleted = FALSE").Scan(&totalUsers); err != nil {
		h.handleError(w, fmt.Errorf("ошибка получения статистики пользователей"), http.StatusInternalServerError)
		return
	}

	var totalOrders int
	if err := h.dbProvider.db.QueryRow("SELECT COUNT(*) FROM orders").Scan(&totalOrders); err != nil {
		h.handleError(w, fmt.Errorf("ошибка получения статистики заказов"), http.StatusInternalServerError)
		return
	}

	dbSizeMutex.RLock()
	currentDBSize := databaseSize
	dbSizeMutex.RUnlock()

	stats := map[string]interface{}{
		"totalUsers":           totalUsers,
		"totalOrders":          totalOrders,
		"databaseSize":         currentDBSize,
		"lastBackup":           time.Now().Add(-24 * time.Hour).Format("2006-01-02 15:04:05"),
		"registrationEnabled":  registrationEnabled,
		"orderCreationEnabled": orderCreationEnabled,
		"dbConnected":          true,
	}

	h.handleSuccess(w, stats)
}

func (h *Handlers) GetSystemStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"database": map[string]string{
			"status": "online",
		},
		"api": map[string]string{
			"status": "online",
		},
		"authentication": map[string]string{
			"status": "online",
		},
		"orders": map[string]string{
			"status": "online",
		},
		"users": map[string]string{
			"status": "online",
		},
		"lastCheck": time.Now().Format("2006-01-02 15:04:05"),
	}

	if err := h.dbProvider.db.Ping(); err != nil {
		status["database"] = map[string]string{
			"status": "error",
		}
	}

	h.handleSuccess(w, status)
}

func (h *Handlers) ToggleRegistration(w http.ResponseWriter, r *http.Request) {
	registrationEnabled = !registrationEnabled
	response := map[string]interface{}{
		"registrationEnabled": registrationEnabled,
		"message":             fmt.Sprintf("Регистрация пользователей: %s", map[bool]string{true: "включена", false: "отключена"}[registrationEnabled]),
	}
	h.handleSuccess(w, response)
}

func (h *Handlers) ToggleOrderCreation(w http.ResponseWriter, r *http.Request) {
	orderCreationEnabled = !orderCreationEnabled
	response := map[string]interface{}{
		"orderCreationEnabled": orderCreationEnabled,
		"message":              fmt.Sprintf("Создание заказов: %s", map[bool]string{true: "включено", false: "отключено"}[orderCreationEnabled]),
	}
	h.handleSuccess(w, response)
}

func (h *Handlers) GetMachines(w http.ResponseWriter, r *http.Request) {
	var machines []Machine
	var fetchErr error

	requiredCapacity := r.URL.Query().Get("required_capacity")
	if requiredCapacity != "" {
		capacity, _ := strconv.Atoi(requiredCapacity)
		machines, fetchErr = h.dbProvider.GetAvailableMachines(capacity)
	} else {
		machines, fetchErr = h.dbProvider.GetMachines()
	}

	if fetchErr != nil {
		h.handleError(w, fetchErr, http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, machines)
}

func (h *Handlers) GetAllMachines(w http.ResponseWriter, r *http.Request) {
	machines, err := h.dbProvider.GetAllMachines()
	if err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}
	h.handleSuccess(w, machines)
}

func (h *Handlers) CreateMachine(w http.ResponseWriter, r *http.Request) {
	var machine Machine
	if err := json.NewDecoder(r.Body).Decode(&machine); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	if err := h.dbProvider.CreateMachine(machine); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	h.handleSuccess(w, map[string]string{"message": "Машина успешно создана"})
}

func (h *Handlers) UpdateMachine(w http.ResponseWriter, r *http.Request) {
	var machine Machine
	if err := json.NewDecoder(r.Body).Decode(&machine); err != nil {
		h.handleError(w, fmt.Errorf("ошибка декодирования JSON"), http.StatusBadRequest)
		return
	}

	if err := h.dbProvider.UpdateMachine(machine); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, map[string]string{"message": "Машина успешно обновлена"})
}

func (h *Handlers) DeleteMachine(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	machineID := vars["id"]

	if err := h.dbProvider.DeleteMachine(machineID); err != nil {
		h.handleError(w, err, http.StatusInternalServerError)
		return
	}

	h.handleSuccess(w, map[string]string{"message": "Машина успешно удалена"})
}

func (dp *DatabaseProvider) InsertAccount(login string, password string, role string) error {
	_, err := dp.db.Exec("INSERT INTO accounts (login, password, role, is_deleted) VALUES ($1, $2, $3, FALSE)", login, password, role)
	return err
}

func (dp *DatabaseProvider) SelectOrders(login string) (*sql.Rows, error) {
	return dp.db.Query("SELECT o_number, o_betonv, o_betonmark, o_betontarget, o_betontime, o_createdtime, o_logcreater, o_price FROM orders WHERE o_logcreater = $1", login)
}

func (dp *DatabaseProvider) GetOrdersWithStatus(login string) (*sql.Rows, error) {
	return dp.db.Query(`
		SELECT o_number, o_betonv, o_betonmark, o_betontarget, o_betontime, 
			o_createdtime, o_logcreater, o_price, o_status, o_machine_id 
		FROM orders 
		WHERE o_logcreater = $1 
		ORDER BY 
			CASE 
				WHEN o_status IN ('pending', 'in_progress') THEN 1
				ELSE 2
			END,
			o_createdtime DESC
	`, login)
}

func (dp *DatabaseProvider) InsertOrder(order Order) error {
	_, err := dp.db.Exec("INSERT INTO orders (o_betonv, o_betonmark, o_betontarget, o_betontime, o_logcreater, o_createdtime, o_price, o_status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')",
		order.BetonV, order.BetonMark, order.BetonTarget, order.BetonTime, order.LogCreater, order.CreatedTime, order.Price)
	return err
}

func (dp *DatabaseProvider) SelectAllOrders() (*sql.Rows, error) {
	return dp.db.Query("SELECT o_number, o_betonv, o_betonmark, o_betontarget, o_betontime, o_createdtime, o_logcreater, o_price FROM orders")
}

func (dp *DatabaseProvider) GetAllOrdersWithStatus() (*sql.Rows, error) {
	return dp.db.Query(`
		SELECT o_number, o_betonv, o_betonmark, o_betontarget, o_betontime, 
			o_createdtime, o_logcreater, o_price, o_status, o_machine_id 
		FROM orders 
		ORDER BY 
			CASE 
				WHEN o_status IN ('pending', 'in_progress') THEN 1
				ELSE 2
			END,
			o_createdtime DESC
	`)
}

func (dp *DatabaseProvider) UpdateOrder(order Order) error {
	_, err := dp.db.Exec("UPDATE orders SET o_betonv = $1, o_betonmark = $2, o_betontarget = $3, o_betontime = $4, o_price = $5 WHERE o_number = $6",
		order.BetonV, order.BetonMark, order.BetonTarget, order.BetonTime, order.Price, order.Number)
	return err
}

func (dp *DatabaseProvider) UpdateOrderWithStatus(order OrderWithStatus) error {
	if order.Status == "cancelled" {
		_, err := dp.db.Exec(`
            UPDATE orders 
            SET o_betonv = $1, o_betonmark = $2, o_betontarget = $3, 
                o_betontime = $4, o_price = $5, o_status = $6, o_machine_id = NULL
            WHERE o_number = $7`,
			order.BetonV, order.BetonMark, order.BetonTarget, order.BetonTime,
			order.Price, order.Status, order.Number)
		return err
	} else {
		_, err := dp.db.Exec(`
            UPDATE orders 
            SET o_betonv = $1, o_betonmark = $2, o_betontarget = $3, 
                o_betontime = $4, o_price = $5, o_status = $6, o_machine_id = $7 
            WHERE o_number = $8`,
			order.BetonV, order.BetonMark, order.BetonTarget, order.BetonTime,
			order.Price, order.Status, order.MachineID, order.Number)
		return err
	}
}

func (dp *DatabaseProvider) DeleteOrder(orderID string) error {
	_, err := dp.db.Exec("DELETE FROM orders WHERE o_number = $1", orderID)
	return err
}

func (dp *DatabaseProvider) UpdateConcretePrice(grade string, price int) error {
	_, err := dp.db.Exec(
		"INSERT INTO concrete_prices (grade, price) VALUES ($1, $2) "+
			"ON CONFLICT (grade) DO UPDATE SET price = $2",
		grade, price,
	)
	return err
}

func (dp *DatabaseProvider) GetConcreteGrades() ([]string, error) {
	var grades []string
	rows, err := dp.db.Query("SELECT grade FROM concrete_prices ORDER BY CAST(SUBSTRING(grade FROM 'M([0-9]+)') AS INTEGER)")
	if err != nil {
		rows, err = dp.db.Query("SELECT grade FROM concrete_prices ORDER BY grade")
		if err != nil {
			return nil, err
		}
	}
	defer rows.Close()

	for rows.Next() {
		var grade string
		if err := rows.Scan(&grade); err != nil {
			return nil, err
		}
		grades = append(grades, grade)
	}

	if len(grades) > 0 {
		sort.Slice(grades, func(i, j int) bool {
			numI, errI := strconv.Atoi(strings.TrimPrefix(grades[i], "M"))
			numJ, errJ := strconv.Atoi(strings.TrimPrefix(grades[j], "M"))
			if errI == nil && errJ == nil {
				return numI < numJ
			}
			return grades[i] < grades[j]
		})
	}

	return grades, nil
}

func (dp *DatabaseProvider) AddConcreteGrade(grade string, price int) error {
	_, err := dp.db.Exec(
		"INSERT INTO concrete_prices (grade, price) VALUES ($1, $2)",
		grade, price,
	)
	return err
}

func (dp *DatabaseProvider) DeleteConcreteGrade(grade string) error {
	_, err := dp.db.Exec("DELETE FROM concrete_prices WHERE grade = $1", grade)
	return err
}

func (dp *DatabaseProvider) GetAllUsers() ([]User, error) {
	var users []User
	rows, err := dp.db.Query("SELECT login, role FROM accounts WHERE is_deleted = FALSE ORDER BY login")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var user User
		if err := rows.Scan(&user.Login, &user.Role); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

func (dp *DatabaseProvider) UpdateUser(user User) error {
	_, err := dp.db.Exec("UPDATE accounts SET role = $1 WHERE login = $2 AND is_deleted = FALSE", user.Role, user.Login)
	return err
}

func (dp *DatabaseProvider) DeleteUser(login string) error {
	_, err := dp.db.Exec("UPDATE accounts SET is_deleted = TRUE WHERE login = $1", login)
	return err
}

func (dp *DatabaseProvider) GetMachines() ([]Machine, error) {
	var machines []Machine
	rows, err := dp.db.Query("SELECT id, plate_number, type, capacity, is_active FROM machines WHERE deleted_at IS NULL ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var machine Machine
		if err := rows.Scan(&machine.ID, &machine.PlateNumber, &machine.Type, &machine.Capacity, &machine.IsActive); err != nil {
			return nil, err
		}
		machines = append(machines, machine)
	}
	return machines, nil
}

func (dp *DatabaseProvider) GetAllMachines() ([]Machine, error) {
	var machines []Machine
	rows, err := dp.db.Query("SELECT id, plate_number, type, capacity, is_active FROM machines ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var machine Machine
		if err := rows.Scan(&machine.ID, &machine.PlateNumber, &machine.Type, &machine.Capacity, &machine.IsActive); err != nil {
			return nil, err
		}
		machines = append(machines, machine)
	}
	return machines, nil
}

func (dp *DatabaseProvider) GetAvailableMachines(requiredCapacity int) ([]Machine, error) {
	var machines []Machine
	rows, err := dp.db.Query(`
		SELECT id, plate_number, type, capacity, is_active 
		FROM machines 
		WHERE is_active = TRUE AND capacity >= $1 AND deleted_at IS NULL
		AND id NOT IN (
			SELECT o_machine_id FROM orders 
			WHERE o_status IN ('pending', 'in_progress') AND o_machine_id IS NOT NULL
		)
		ORDER BY capacity
	`, requiredCapacity)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var machine Machine
		if err := rows.Scan(&machine.ID, &machine.PlateNumber, &machine.Type, &machine.Capacity, &machine.IsActive); err != nil {
			return nil, err
		}
		machines = append(machines, machine)
	}
	return machines, nil
}

func (dp *DatabaseProvider) CreateMachine(machine Machine) error {
	_, err := dp.db.Exec(
		"INSERT INTO machines (plate_number, type, capacity, is_active) VALUES ($1, $2, $3, $4)",
		machine.PlateNumber, machine.Type, machine.Capacity, machine.IsActive,
	)
	return err
}

func (dp *DatabaseProvider) UpdateMachine(machine Machine) error {
	_, err := dp.db.Exec(
		"UPDATE machines SET plate_number = $1, type = $2, capacity = $3, is_active = $4 WHERE id = $5 AND deleted_at IS NULL",
		machine.PlateNumber, machine.Type, machine.Capacity, machine.IsActive, machine.ID,
	)
	return err
}

func (dp *DatabaseProvider) DeleteMachine(machineID string) error {
	_, err := dp.db.Exec("UPDATE machines SET is_active = FALSE, deleted_at = NOW() WHERE id = $1", machineID)
	return err
}

func (h *Handlers) setupRoutes(r *mux.Router) {
	// Public routes
	public := r.PathPrefix("").Subrouter()
	public.HandleFunc("/account", h.PostAccount).Methods("POST")
	public.HandleFunc("/login", h.PostLogin).Methods("POST")
	public.HandleFunc("/prices", h.GetConcretePrices).Methods("GET")
	public.HandleFunc("/concrete/grades", h.GetConcreteGrades).Methods("GET")

	// User routes (для всех авторизованных пользователей)
	userRoutes := r.PathPrefix("").Subrouter()
	userRoutes.Use(h.requireAuth())
	userRoutes.HandleFunc("/orders", h.GetOrders).Methods("GET")
	userRoutes.HandleFunc("/orders/with-status", h.GetOrdersWithStatus).Methods("GET")
	userRoutes.HandleFunc("/orders/create", h.PostOrder).Methods("POST")

	// Seller routes (только для seller и admin)
	sellerRoutes := r.PathPrefix("/seller").Subrouter()
	sellerRoutes.Use(h.requireAuth("seller", "admin"))
	sellerRoutes.HandleFunc("/orders", h.GetAllOrders).Methods("GET")
	sellerRoutes.HandleFunc("/orders/with-status", h.GetAllOrdersWithStatus).Methods("GET")
	sellerRoutes.HandleFunc("/orders/update", h.UpdateOrder).Methods("POST")
	sellerRoutes.HandleFunc("/orders/update-with-status", h.UpdateOrderWithStatus).Methods("POST")
	sellerRoutes.HandleFunc("/orders/delete/{id}", h.DeleteOrder).Methods("DELETE")
	sellerRoutes.HandleFunc("/prices", h.UpdateConcretePrices).Methods("POST")
	sellerRoutes.HandleFunc("/concrete/grades", h.AddConcreteGrade).Methods("POST")
	sellerRoutes.HandleFunc("/concrete/grades/{grade}", h.DeleteConcreteGrade).Methods("DELETE")
	sellerRoutes.HandleFunc("/machines", h.GetMachines).Methods("GET")
	sellerRoutes.HandleFunc("/all-machines", h.GetAllMachines).Methods("GET")
	sellerRoutes.HandleFunc("/machines", h.CreateMachine).Methods("POST")
	sellerRoutes.HandleFunc("/machines", h.UpdateMachine).Methods("PUT")
	sellerRoutes.HandleFunc("/machines/{id}", h.DeleteMachine).Methods("DELETE")

	// Admin routes (только для admin)
	adminRoutes := r.PathPrefix("/admin").Subrouter()
	adminRoutes.Use(h.requireAuth("admin"))
	adminRoutes.HandleFunc("/users", h.GetAllUsers).Methods("GET")
	adminRoutes.HandleFunc("/users", h.CreateUser).Methods("POST")
	adminRoutes.HandleFunc("/users", h.UpdateUser).Methods("PUT")
	adminRoutes.HandleFunc("/users/{login}", h.DeleteUser).Methods("DELETE")
	adminRoutes.HandleFunc("/stats", h.GetAppStats).Methods("GET")
	adminRoutes.HandleFunc("/status", h.GetSystemStatus).Methods("GET")
	adminRoutes.HandleFunc("/toggle-registration", h.ToggleRegistration).Methods("POST")
	adminRoutes.HandleFunc("/toggle-orders", h.ToggleOrderCreation).Methods("POST")
}

func main() {
	address := flag.String("address", "127.0.0.1:8081", "адрес для запуска сервера")
	flag.Parse()

	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s dbname=%s sslmode=disable", host, port, user, dbname)

	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	dp := DatabaseProvider{db: db}
	h := Handlers{dbProvider: dp}

	r := mux.NewRouter()
	h.setupRoutes(r)

	cors := handlers.CORS(
		handlers.AllowedOrigins([]string{"*"}),
		handlers.AllowedMethods([]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}),
		handlers.AllowedHeaders([]string{"Content-Type", "Authorization"}),
	)

	log.Printf("Сервер запущен на %s", *address)
	if err := http.ListenAndServe(*address, cors(r)); err != nil {
		log.Fatal(err)
	}
}
